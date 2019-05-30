/**
 * Copyright 2018-2019 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const cloudUtil = require('@f5devcentral/f5-cloud-libs').util;
const PRODUCTS = require('@f5devcentral/f5-cloud-libs').sharedConstants.PRODUCTS;
const doUtil = require('./doUtil');
const Logger = require('./logger');
const PATHS = require('./sharedConstants').PATHS;
const EVENTS = require('./sharedConstants').EVENTS;

const logger = new Logger(module);

/**
 * Handles system parts of a declaration.
 *
 * @class
 */
class SystemHandler {
    /**
     * Constructor
     *
     * @param {Object} declaration - Parsed declaration.
     * @param {Object} bigIp - BigIp object.
     * @param {EventEmitter} - DO event emitter.
     * @param {State} - The doState.
     */
    constructor(declaration, bigIp, eventEmitter, state) {
        this.declaration = declaration;
        this.bigIp = bigIp;
        this.eventEmitter = eventEmitter;
        this.state = state;
    }

    /**
     * Starts processing.
     *
     * @returns {Promise} A promise which is resolved when processing is complete
     *                    or rejected if an error occurs.
     */
    process() {
        logger.fine('Processing system declaration.');
        if (!this.declaration.Common) {
            return Promise.resolve();
        }

        logger.fine('Checking db variables.');
        return handleDbVars.call(this)
            .then(() => {
                logger.fine('Checking DNS.');
                return handleDNS.call(this);
            })
            .then(() => {
                logger.fine('Checking NTP.');
                return handleNTP.call(this);
            })
            .then(() => {
                logger.fine('Checking hostname.');
                return handleHostname.call(this);
            })
            .then(() => {
                logger.fine('Checking Users.');
                return handleUser.call(this);
            })
            .then(() => {
                logger.fine('Checking License.');
                return handleLicense.call(this);
            })
            .then(() => {
                logger.fine('Done processing system declaration.');
                return Promise.resolve();
            })
            .catch((err) => {
                logger.severe(`Error processing system declaration: ${err.message}`);
                return Promise.reject(err);
            });
    }
}

function handleDbVars() {
    if (this.declaration.Common.DbVariables) {
        return this.bigIp.onboard.setDbVars(this.declaration.Common.DbVariables);
    }
    return Promise.resolve();
}

function handleNTP() {
    if (this.declaration.Common.NTP) {
        const ntp = this.declaration.Common.NTP;
        const promises = (ntp.servers || []).map((server) => {
            return doUtil.checkDnsResolution(server);
        });

        return Promise.all(promises)
            .then(() => {
                return disableDhcpOptions.call(this, ['ntp-servers']);
            })
            .then(() => {
                return this.bigIp.replace(
                    PATHS.NTP,
                    {
                        servers: ntp.servers,
                        timezone: ntp.timezone
                    }
                );
            });
    }
    return Promise.resolve();
}

function handleDNS() {
    if (this.declaration.Common.DNS) {
        const dns = this.declaration.Common.DNS;
        const dhcpOptionsToDisable = [];

        if (dns.nameServers) {
            dhcpOptionsToDisable.push('domain-name-servers');
        }
        if (dns.search) {
            // dhclient calls search 'domain-name'
            dhcpOptionsToDisable.push('domain-name');
        }

        return disableDhcpOptions.call(this, dhcpOptionsToDisable)
            .then(() => {
                return this.bigIp.replace(
                    PATHS.DNS,
                    {
                        'name-servers': dns.nameServers,
                        search: dns.search || []
                    }
                );
            })
            .then(() => {
                return restartDhcp.call(this);
            });
    }
    return Promise.resolve();
}

function handleHostname() {
    if (this.declaration.Common.hostname) {
        return this.bigIp.onboard.hostname(this.declaration.Common.hostname);
    }
    return Promise.resolve();
}

function handleUser() {
    if (this.declaration.Common.User) {
        const promises = [];
        const userNames = Object.keys(this.declaration.Common.User);
        userNames.forEach((username) => {
            const user = this.declaration.Common.User[username];
            if (user.userType === 'root' && username === 'root') {
                promises.push(this.bigIp.onboard.password(
                    'root',
                    user.newPassword,
                    user.oldPassword
                ));
            } else if (user.userType === 'regular') {
                promises.push(createOrUpdateUser.call(this, username, user));
            } else {
                // eslint-disable-next-line max-len
                logger.warning(`${username} has userType root. Only the root user can have userType root.`);
            }
        });

        return Promise.all(promises);
    }
    return Promise.resolve();
}

function handleLicense() {
    if (this.declaration.Common.License) {
        const license = this.declaration.Common.License;
        if (license.regKey || license.addOnKeys) {
            return handleRegKey.call(this, license);
        }
        return handleLicensePool.call(this, license);
    }
    return Promise.resolve();
}

function handleRegKey(license) {
    return this.bigIp.onboard.license(
        {
            registrationKey: license.regKey,
            addOnKeys: license.addOnKeys,
            overwrite: license.overwrite
        }
    )
        .then(() => {
            return this.bigIp.active();
        })
        .catch((err) => {
            const errorLicensing = `Error licensing: ${err.message}`;
            logger.severe(errorLicensing);
            err.message = errorLicensing;
            return Promise.reject(err);
        });
}

function handleLicensePool(license) {
    // If we're using the reachable API, we need a bigIp object
    // that has the right credentials and host IP
    let getBigIp;
    let bigIp;
    let currentPlatform;

    if (license.reachable) {
        getBigIp = new Promise((resolve, reject) => {
            this.bigIp.deviceInfo()
                .then((deviceInfo) => {
                    return doUtil.getBigIp(
                        logger,
                        {
                            host: deviceInfo.managementAddress,
                            user: license.bigIpUsername,
                            password: license.bigIpPassword
                        }
                    );
                })
                .then((resolvedBigIp) => {
                    resolve(resolvedBigIp);
                })
                .catch((err) => {
                    logger.severe(`Error getting big ip for reachable API: ${err.message}`);
                    reject(err);
                });
        });
    } else {
        getBigIp = Promise.resolve(this.bigIp);
    }

    let promise = Promise.resolve();
    if (license.bigIqHost) {
        promise = promise.then(() => {
            return doUtil.checkDnsResolution(license.bigIqHost);
        });
    }

    return promise
        .then(() => {
            return doUtil.getCurrentPlatform();
        })
        .then((platform) => {
            currentPlatform = platform;
            return getBigIp;
        })
        .then((resolvedBigIp) => {
            bigIp = resolvedBigIp;
            let possiblyRevoke;

            if (license.revokeFrom) {
                let licenseInfo;
                let licensePoolName;

                if (typeof license.revokeFrom === 'string') {
                    licenseInfo = license;
                    licensePoolName = license.revokeFrom;
                } else {
                    licenseInfo = license.revokeFrom;
                    licensePoolName = license.revokeFrom.licensePool;
                }

                const options = {
                    licensePoolName,
                    bigIqHost: licenseInfo.bigIqHost,
                    bigIqUser: licenseInfo.bigIqUsername,
                    bigIqPassword: licenseInfo.bigIqPassword,
                    bigIqPasswordUri: licenseInfo.bigIqPasswordUri
                };

                // If our license is about to be revoked, let everyone know
                if (licenseInfo.reachable) {
                    this.eventEmitter.emit(
                        EVENTS.DO_LICENSE_REVOKED,
                        this.state.id,
                        licenseInfo.bigIpPassword,
                        licenseInfo.bigIqPassword
                    );
                }

                possiblyRevoke = bigIp.onboard.revokeLicenseViaBigIq(
                    options.bigIqHost || 'localhost',
                    options.bigIqUser,
                    options.bigIqPassword || options.bigIqPasswordUri,
                    options.licensePoolName,
                    {
                        bigIqMgmtPort: getBigIqManagementPort.call(this, currentPlatform, licenseInfo),
                        passwordIsUri: !!options.bigIqPasswordUri,
                        noUnreachable: !!license.reachable
                    }
                );
            } else {
                possiblyRevoke = Promise.resolve();
            }

            return possiblyRevoke;
        })
        .then(() => {
            if (license.licensePool) {
                return bigIp.onboard.licenseViaBigIq(
                    license.bigIqHost || 'localhost',
                    license.bigIqUsername,
                    license.bigIqPassword || license.bigIqPasswordUri,
                    license.licensePool,
                    license.hypervisor,
                    {
                        bigIqMgmtPort: getBigIqManagementPort.call(this, currentPlatform, license),
                        passwordIsUri: !!license.bigIqPasswordUri,
                        skuKeyword1: license.skuKeyword1,
                        skuKeyword2: license.skuKeyword2,
                        unitOfMeasure: license.unitOfMeasure,
                        noUnreachable: !!license.reachable,
                        overwrite: !!license.overwrite,
                        autoApiType: true
                    }
                );
            }

            return Promise.resolve();
        })
        .then(() => {
            // Don't try to check for active state if we only revoked
            // An unlicensed device will return OFFLINE status
            if (typeof license.licensePool === 'undefined') {
                return Promise.resolve();
            }
            return this.bigIp.active();
        })
        .catch((err) => {
            return Promise.reject(err);
        });
}

function createOrUpdateUser(username, data) {
    let userEndpoint = '/tm/auth/user';
    if (this.bigIp.isBigIq()) {
        userEndpoint = '/shared/authz/users';
    }

    const body = {
        name: username
    };

    if (data.password) {
        body.password = data.password;
    }

    if (data.shell) {
        body.shell = data.shell;
    }

    if (data.partitionAccess) {
        body['partition-access'] = [];
        Object.keys(data.partitionAccess).forEach((partition) => {
            body['partition-access'].push(
                {
                    name: partition,
                    role: data.partitionAccess[partition].role
                }
            );
        });
    }

    return this.bigIp.createOrModify(userEndpoint, body)
        .then(() => {
            // If we're setting the password for our user, we need to
            // re-initialize the bigIp core
            if (username === this.bigIp.user) {
                return this.bigIp.init(
                    this.bigIp.host,
                    this.bigIp.user,
                    data.password,
                    { port: this.bigIp.port }
                );
            }
            return Promise.resolve();
        })
        .catch((err) => {
            logger.severe(`Error creating/updating user: ${err.message}`);
            return Promise.reject(err);
        });
}

function disableDhcpOptions(optionsToDisable) {
    let requiresDhcpRestart;

    return this.bigIp.list(
        '/tm/sys/management-dhcp/sys-mgmt-dhcp-config'
    )
        .then((dhcpOptions) => {
            if (!dhcpOptions || !dhcpOptions.requestOptions) {
                return Promise.resolve();
            }

            const currentOptions = dhcpOptions.requestOptions;
            const newOptions = currentOptions.filter((option) => {
                return optionsToDisable.indexOf(option) === -1;
            });

            if (currentOptions.length === newOptions.length) {
                return Promise.resolve();
            }

            requiresDhcpRestart = true;
            return this.bigIp.modify(
                '/tm/sys/management-dhcp/sys-mgmt-dhcp-config',
                {
                    requestOptions: newOptions
                }
            );
        })
        .then(() => {
            if (!requiresDhcpRestart) {
                return Promise.resolve();
            }
            return restartDhcp.call(this);
        });
}

function getBigIqManagementPort(currentPlatform, license) {
    let bigIqMgmtPort;
    // If we're on BIG-IQ and we're going to license from this device
    // set up for no auth via port 8100
    if (currentPlatform === PRODUCTS.BIGIQ
        && (!license.bigIqHost || license.bigIqHost === 'localhost')) {
        bigIqMgmtPort = 8100;
    }
    return bigIqMgmtPort;
}

function restartDhcp() {
    return this.bigIp.create(
        '/tm/sys/service',
        {
            command: 'restart',
            name: 'dhclient'
        }
    )
        .then(() => {
            function isDhcpRunning() {
                return this.bigIp.list('/tm/sys/service/dhclient/stats')
                    .then((dhcpStats) => {
                        if (dhcpStats.apiRawValues
                            && dhcpStats.apiRawValues.apiAnonymous
                            && dhcpStats.apiRawValues.apiAnonymous.indexOf('is running') !== -1) {
                            return Promise.resolve();
                        }

                        let message;
                        if (dhcpStats.apiRawValues && dhcpStats.apiRawValues.apiAnonymous) {
                            message = `dhclient status is ${dhcpStats.apiRawValues.apiAnonymous}`;
                        } else {
                            message = 'Unable to read dhclient status';
                        }
                        return Promise.reject(new Error(message));
                    });
            }

            return cloudUtil.tryUntil(this, cloudUtil.MEDIUM_RETRY, isDhcpRunning);
        });
}

module.exports = SystemHandler;
