'use strict';

function JsonValidator(schema, data) {
    var validatorClass;
    if (schema.enum) {
        validatorClass = JsonEnum;
    }
    else {
        switch (schema.type) {
        case 'array':
            validatorClass = JsonArray;
            break;
        case 'boolean':
            validatorClass = JsonBoolean;
            break;
        case 'integer':
        case 'number':
            validatorClass = JsonNumber;
            break;
        case 'null':
            validatorClass = JsonNull;
            break;
        case 'object':
            validatorClass = JsonObject;
            break;
        case 'string':
            validatorClass = JsonString;
            break;
        default:
            break;
        }
    }
    return new validatorClass(schema, data);
};
_.extend(JsonValidator.prototype, {
    validations: {},

    validate: function () {
        _.each(this.validations, function (validation, key) {
            if (this.schema.hasOwnProperty(key)) {
                var error = validation(this.schema[key], this.value());
                error && this.errors.push(error);
            }
        }, this);
    },

    valid: function () {
        return !this.errors.length;
    },

    value: function () {
        return this.data;
    },

    initialize: function (schema, data) {
        this.schema = schema;
        this.setData(data === undefined ? schema.default : data);
    },

    setData: function (data) {
        this.data = data;
        this.errors = [];
        this.validate();
        return this;
    },

    inline: true
});

function JsonEnum(schema, data) {
    this.initialize(schema, data);
};
_.extend(JsonEnum.prototype, JsonValidator.prototype, {
    valid: function () {
        return this.schema.enum.indexOf(this.value()) !== -1;
    },

    inline: false
});

function JsonArray(schema, data) {
    this.initialize(schema, data);
};
_.extend(JsonArray.prototype, JsonValidator.prototype, {
    setData: function (data) {
        this.errors = [];
        this.items = [];
        data = data || [];

        if (typeof(this.schema.items) === 'array') {
            for (var i = 0; i < data.length; i++) {
                this.items[i] = new JsonValidator(this.schema.items[i], data[i]);
            }
        }
        else if (typeof(this.schema.items) === 'object') {
            var length = data.length;
            if (this.schema.hasOwnProperty('minItems') &&
                this.schema.minItems > length) {
                length = this.schema.minItems;
            }
            for (var i = 0; i < length; i++) {
                this.items[i] = new JsonValidator(this.schema.items, data[i]);
            }
        }
        return this;
    },

    value: function () {
        return _.map(this.items, function (validator) {
            return validator.value();
        });
    },

    valid: function () {
        return JsonValidator.prototype.valid.call(this) &&
            _.every(this.items, function (validator) {
                return validator.valid();
            });
    },

    inline: false
});

function JsonObject(schema, data) {
    this.initialize(schema, data);
}
_.extend(JsonObject.prototype, JsonValidator.prototype, {
    setData: function (data) {
        this.errors = [];
        this.properties = {};
        data = data || {};

        _.each(data, function (property, key) {
            var subschema;
            if (this.schema.properties &&
                this.schema.properties.hasOwnProperty(key)) {
                subschema = this.schema.properties[key];
            }
            else if (this.schema.additionalProperties) {
                subschema = this.schema.additionalProperties;
            }

            if (subschema) {
                this.properties[key] = new JsonValidator(subschema, property);
            }
            else {
                this.errors.push('Unknown property: ' + key);
            }
        }, this);

        _.each(this.schema.required || [], function (key) {
            if (!data.hasOwnProperty(key)) {
                this.properties[key] = new JsonValidator(this.schema.properties[key]);
            }
        }, this);
        return this;
    },

    value: function () {
        var data = {};
        _.each(this.properties, function (validator, key) {
            data[key] = validator.value();
        });
        return data;
    },

    valid: function () {
        return JsonValidator.prototype.valid.call(this) &&
            _.every(this.properties, function (validator) {
                return validator.valid();
            });
    },

    required: function (property) {
        return this.schema.required &&
            this.schema.required.indexOf(property) != -1;
    },

    inline: false
});

function JsonString(schema, data) {
    this.initialize(schema, data);
};
_.extend(JsonString.prototype, JsonValidator.prototype, {
    validations: {
        minLength: function (minLength, data) {
            if (data.length < minLength) {
                return "Must be at least " + minLength + " characters";
            }
        },
        maxLength: function (maxLength, data) {
            if (data.length > maxLength) {
                return "Must be at most " + maxLength + " characters";
            }
        },
        pattern: function (pattern, data) {
            if (!(new RegExp(pattern)).test(data)) {
                return "Must match pattern: " + pattern;
            }
        }
    },

    setData: function (data) {
        return JsonValidator.prototype.setData.call(this, data || "");
    }
});

function JsonBoolean(schema, data) {
    this.initialize(schema, data);
};
_.extend(JsonBoolean.prototype, JsonValidator.prototype, {
    setData: function (data) {
        return JsonValidator.prototype.setData.call(this, data || false);
    }
});

function JsonNull(schema, _data) {
    this.schema = schema;
    this.errors = [];
};
_.extend(JsonNull.prototype, {
    setData: function (_data) {
        return this;
    },

    valid: function () {
        return true;
    },

    value: function () {
        return null;
    },

    inline: true
});

function JsonNumber(schema, data) {
    this.initialize(schema, data);
};
_.extend(JsonNumber.prototype, JsonValidator.prototype, {
    validations: {
        multipleOf: function (multipleOf, data) {
            if (data % multipleOf !== 0) {
                return "Must be a multiple of " + multipleOf;
            }
        },
        maximum: function (maximum, data) {
            if (data > maximum) {
                return "Must be less than or equal to " + maximum;
            }
        },
        minimum: function (minimum, data) {
            if (data < minimum) {
                return "Must be greater than or equal to " + minimum;
            }
        },
        exclusiveMaximum: function (exclusiveMaximum, data) {
            if (data >= exclusiveMaximum) {
                return "Must be less than " + exclusiveMaximum;
            }
        },
        exclusiveMinimum: function (exclusiveMinimum, data) {
            if (data <= exclusiveMinimum) {
                return "Must be greater than " + exclusiveMinimum;
            }
        }
    },

    validate: function () {
        if (typeof(this.value()) !== 'number') {
            this.errors.push("Must be a number")
        }
        else if (this.schema.type === 'integer' && this.value() % 1 !== 0) {
            this.errors.push("Must be an integer")
        }
        else {
            JsonValidator.prototype.validate.call(this);
        }
    }
});
