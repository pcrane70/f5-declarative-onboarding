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

const BASE_URL = require('./sharedConstants').BASE_URL;
const ENDPOINTS = require('./sharedConstants').ENDPOINTS;
const STATUS = require('./sharedConstants').STATUS;

class ConfigResponse {
    constructor(state) {
        this.state = state;
    }

    // Many of these methods do not need 'this' as they return constants
    // but the must be instance methods for consistency with other responders
    getSelfLink(id) {
        return `${BASE_URL}/${ENDPOINTS.CONFIG}/${id}`;
    }

    exists(id) {
        return !!this.state.getOriginalConfigByConfigId(id);
    }

    getIds() {
        return this.state.getOriginalConfigIds();
    }

    getCode() {
        return 200;
    }

    getStatus() {
        return STATUS.STATUS_OK;
    }

    getMessage() {
        return '';
    }

    getErrors() {
        return [];
    }

    getData(id) {
        const data = this.state.getOriginalConfigByConfigId(id);
        return data;
    }
}

module.exports = ConfigResponse;
