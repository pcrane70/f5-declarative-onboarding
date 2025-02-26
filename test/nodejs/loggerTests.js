/**
 * Copyright 2018 F5 Networks, Inc.
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

const assert = require('assert');
const Logger = require('../../nodejs/logger');

const logger = new Logger(module);

const loggedMessages = {
    silly: [],
    verbose: [],
    debug: [],
    warning: [],
    info: [],
    error: [],
    finest: [],
    finer: [],
    fine: [],
    warn: [],
    severe: []
};

const loggerMock = {
    silly(message) { loggedMessages.silly.push(message); },
    verbose(message) { loggedMessages.verbose.push(message); },
    debug(message) { loggedMessages.debug.push(message); },
    warning(message) { loggedMessages.warning.push(message); },
    info(message) { loggedMessages.info.push(message); },
    error(message) { loggedMessages.error.push(message); },
    finest(message) { loggedMessages.finest.push(message); },
    finer(message) { loggedMessages.finer.push(message); },
    fine(message) { loggedMessages.fine.push(message); },
    warn(message) { loggedMessages.warn.push(message); },
    severe(message) { loggedMessages.severe.push(message); }
};

logger.logger = loggerMock;

describe('logger', () => {
    beforeEach(() => {
        Object.keys(loggedMessages).forEach((level) => {
            loggedMessages[level].length = 0;
        });
    });

    it('should log at the appropriate level', () => {
        Object.keys(loggedMessages).forEach((level) => {
            logger[level](`this is a ${level} message`);
        });

        // these levels have something else mapped to them, so there are 2 messages each
        ['warning', 'finest', 'finer', 'fine', 'severe'].forEach((level) => {
            assert.strictEqual(loggedMessages[level].length, 2);
        });

        // info does not have a mapping
        assert.strictEqual(loggedMessages.info.length, 1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('this is a info message'), -1);
    });

    it('should log extra args', () => {
        logger.info('part 1', 'part 2', 'part 3');
        assert.notStrictEqual(loggedMessages.info[0].indexOf('part 1 part 2 part 3'), -1);
    });

    it('should log different types of arguments', () => {
        function assertMessage(level, expectedMsg, args) {
            const caller = logger;
            logger[level].apply(caller, args);

            const fullMsg = `[f5-declarative-onboarding: loggerTests.js] ${expectedMsg}`;
            assert.notStrictEqual(
                loggedMessages[level][0].indexOf(fullMsg),
                -1,
                `Failed for arg value: ${args}`
            );
        }

        const msg = 'string';
        const msgObject = { yes: 'no', theType: 'object' };

        assertMessage('info', msg, [msg]);
        assertMessage('severe', 'undefined', [undefined]);
        assertMessage('fine', 'null', [null]);
        assertMessage('warning', JSON.stringify(msgObject), [msgObject]);
        assertMessage('finest', `null ${JSON.stringify(msgObject)}`, [null, msgObject]);
    });

    it('should mask passwords', () => {
        const myPassword = 'foofoo';
        logger.info({ password: myPassword });
        assert.strictEqual(loggedMessages.info[0].indexOf(myPassword), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('password'), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should deeply mask passwords', () => {
        const myPassword = 'foofoo';
        logger.info({ something: { password: myPassword } });
        assert.strictEqual(loggedMessages.info[0].indexOf(myPassword), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('password'), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should mask passwords within object arrays', () => {
        const myPassword = 'foofoo';
        logger.info([{ password: myPassword }]);
        assert.strictEqual(loggedMessages.info[0].indexOf(myPassword), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('password'), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should mask a secret', () => {
        const mySecret = 'foofoo';
        logger.info({ secret: mySecret });
        assert.strictEqual(loggedMessages.info[0].indexOf(mySecret), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('secret'), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should deeply mask a secret', () => {
        const mySecret = 'foofoo';
        logger.info({ something: { secret: mySecret } });
        assert.strictEqual(loggedMessages.info[0].indexOf(mySecret), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('secret'), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should mask secrets within object arrays', () => {
        const mySecret = 'foofoo';
        logger.info([{ secret: mySecret }]);
        assert.strictEqual(loggedMessages.info[0].indexOf(mySecret), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('secret'), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should mask reg key', () => {
        const myRegKey = 'D3548-07483-24256-24104-0863690';
        logger.info({ regKey: myRegKey });
        assert.strictEqual(loggedMessages.info[0].indexOf(myRegKey), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should mask nested reg key in array', () => {
        const myRegKey = 'D3548-07483-24256-24104-0863690';
        logger.info({
            license: {
                abc: 123,
                regKey: [myRegKey],
                def: [3, 4, 5]
            }
        });
        assert.strictEqual(loggedMessages.info[0].indexOf(myRegKey), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });

    it('should mask more deeply nested reg key', () => {
        const myRegKey = 'D3548-07483-24256-24104-0863690';
        logger.info({
            device: {
                license: {
                    foo: 'bar',
                    regKey: myRegKey,
                    thomas: 'jefferson'
                }
            }
        });
        assert.strictEqual(loggedMessages.info[0].indexOf(myRegKey), -1);
        assert.notStrictEqual(loggedMessages.info[0].indexOf('********'), -1);
    });
});
