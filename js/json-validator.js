'use strict';

function JsonValidator(schema, data, root, fragments) {
    root = root || schema;
    fragments = fragments || [];
    schema = this.resolveSchema(schema, root, fragments);

    var validatorClass;
    for (var i = JsonValidator.validators.length - 1; i >= 0; i--) {
        validatorClass = JsonValidator.validators[i];
        if (validatorClass.validatesSchema(schema)) {
            break;
        }
        validatorClass = null;
    }

    return new validatorClass(schema, data, root, fragments);
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

    initialize: function (schema, data, root, fragments) {
        this.schema = schema;
        this.root = root;
        this.fragments = fragments;
        this.setData(data === undefined ? schema.default : data);
    },

    setData: function (data) {
        this.data = data;
        this.errors = [];
        this.validate();
        return this;
    },

    resolveReference: function (uri, schema) {
        // TODO: Handle this more generally
        var fragmentPath = uri.split('#')[1];
        var uriFragments = fragmentPath.split('/').slice(1); // First one is ''
        return _.reduce(uriFragments, function (schema, fragment) {
            return schema[fragment];
        }, schema);
    },

    resolveSchema: function (schema, root) {
        if (schema['$ref']) {
            schema = this.resolveReference(schema['$ref'], root);
        }
        if (schema.allOf) {
            var schemata = _.map(schema.allOf, function (schema) {
                return this.resolveSchema(schema, root);
            }, this);
            schemata.push(schema);
            schema = _.extend.apply(this, schemata);
            delete schema.allOf;
        }
        return schema;
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
JsonEnum.validatesSchema = function (schema) {
    return schema.hasOwnProperty('enum');
};

function JsonArray(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
};
_.extend(JsonArray.prototype, JsonValidator.prototype, {
    validations: {
        minItems: function (minItems, data) {
            if (data.length < minItems) {
                return "Must have at least " + minItems + " items";
            }
        },

        maxItems: function (maxItems, data) {
            if (data.length > maxItems) {
                return "Must have at most " + maxItems + " items";
            }
        },
    },

    removeItem: function (i) {
        var value = this.value();
        value.splice(i, 1);
        this.setData(value);
    },

    setData: function (data) {
        this.errors = [];
        this.items = [];
        data = data || [];

        if (typeof(this.schema.items) === 'array') {
            for (var i = 0; i < data.length; i++) {
                var fragments = this.fragments.concat([i]);
                this.items[i] = new JsonValidator(
                    this.schema.items[i], data[i], this.root, fragments);
            }
        }
        else if (typeof(this.schema.items) === 'object') {
            var length = data.length;
            if (this.schema.hasOwnProperty('minItems') &&
                this.schema.minItems > length) {
                length = this.schema.minItems;
            }
            for (var i = 0; i < length; i++) {
                var fragments = this.fragments.concat([i]);
                this.items[i] = new JsonValidator(
                    this.schema.items, data[i], this.root, fragments);
            }
        }
        this.validate();
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
JsonArray.validatesSchema = function (schema) {
    return schema.type === 'array';
};

function JsonObject(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
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
                var fragments = this.fragments.concat([key]);
                this.properties[key] = new JsonValidator(
                    subschema, property, this.root, fragments);
            }
            else {
                this.errors.push('Unknown property: ' + key);
            }
        }, this);

        _.each(this.schema.required || [], function (key) {
            if (!data.hasOwnProperty(key)) {
                var subschema = this.schema.properties[key];
                var fragments = this.fragments.concat([key]);
                this.properties[key] = new JsonValidator(
                    subschema, undefined, this.root, fragments);
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
JsonObject.validatesSchema = function (schema) {
    return schema.type === 'object';
};

function JsonString(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
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
JsonString.validatesSchema = function (schema) {
    return schema.type === 'string';
};

function JsonText(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
};
_.extend(JsonText.prototype, JsonString.prototype, {
    inline: false
});
JsonText.validatesSchema = function (schema) {
    return schema.type === 'string' && schema.display === 'text';
};

function JsonBoolean(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
};
_.extend(JsonBoolean.prototype, JsonValidator.prototype, {
    setData: function (data) {
        return JsonValidator.prototype.setData.call(this, data || false);
    }
});
JsonBoolean.validatesSchema = function (schema) {
    return schema.type === 'boolean';
};

function JsonNull(schema) {
    this.schema = schema;
    this.errors = [];
};
_.extend(JsonNull.prototype, {
    setData: function () {
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
JsonNull.validatesSchema = function (schema) {
    return schema.type === 'null';
};

function JsonNumber(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
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
JsonNumber.validatesSchema = function (schema) {
    return schema.type === 'number' || schema.type === 'integer';
};

JsonValidator.validators = [
    JsonArray,
    JsonObject,
    JsonString,
    JsonText,
    JsonBoolean,
    JsonNull,
    JsonNumber,
    JsonEnum,
];
