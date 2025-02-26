/**
 * Copyright 2019 F5 Networks, Inc.
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

const Ajv = require('ajv');

const remoteSchema = require('../schema/remote.schema.json');
const baseSchema = require('../schema/base.schema.json');
const systemSchema = require('../schema/system.schema.json');
const networkSchema = require('../schema/network.schema.json');
const dscSchema = require('../schema/dsc.schema.json');
const analyticsSchema = require('../schema/analytics.schema.json');
const authSchema = require('../schema/auth.schema.json');

const customFormats = require('../schema/formats.js');

class AjvValidator {
    constructor() {
        const ajv = new Ajv(
            {
                allErrors: false,
                useDefaults: true,
                coerceTypes: true,
                extendRefs: 'fail'
            }
        );

        Object.keys(customFormats).forEach((customFormat) => {
            ajv.addFormat(customFormat, customFormats[customFormat]);
        });

        this.validator = ajv
            .addSchema(systemSchema)
            .addSchema(networkSchema)
            .addSchema(dscSchema)
            .addSchema(analyticsSchema)
            .addSchema(authSchema)
            .addSchema(baseSchema)
            .compile(remoteSchema);
    }

    validate(data) {
        const isValid = this.validator(data);
        return Promise.resolve({
            isValid,
            errors: this.validator.errors
        });
    }
}

module.exports = AjvValidator;
