'use strict';

function JsonValidator(schema, data, root, fragments) {
    root = root || schema;
    fragments = fragments || [];

    var validatorClass;
    if (schema['$ref']) {
        schema = this.resolveReference(schema['$ref'], root, fragments);
    }
    if (schema.allOf) {
        schema = _.defaults.apply(this, _.map(schema.allOf, function (schema) {
            if (schema['$ref']) {
                return this.resolveReference(schema['$ref'], root, fragments);
            }
            return schema;
        }, this));
    }

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
            validatorClass =
                schema.display === 'text' ? JsonText : JsonString;
            break;
        default:
            break;
        }
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

function JsonText(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
};
_.extend(JsonText.prototype, JsonString.prototype, {
    inline: false
});

function JsonBoolean(schema, data, root, fragments) {
    this.initialize(schema, data, root, fragments);
};
_.extend(JsonBoolean.prototype, JsonValidator.prototype, {
    setData: function (data) {
        return JsonValidator.prototype.setData.call(this, data || false);
    }
});

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

/** @jsx React.DOM */

/**
 * Assumptions:
 *   types everywhere
 *
 * Don't work:
 *  Arrays of types
 *  allOf
 *  oneOf
 *  not
 *  additionalProperties as booleans
 *  additionalItems
 *  items array
 *
 * TODO:
 *   definitions
 *  anyOf
 */

(function () {
    var JsonElementMixin = {
        componentDidMount: function () {
            var schema = this.props.schema;

            var defaultValue;
            if (schema.hasOwnProperty('default')) {
                defaultValue = schema.default;
            }
            else if (this.defaultValue) {
                defaultValue = this.defaultValue();
            }

            if (this.props.data === undefined &&
                defaultValue !== undefined) {
                this.props.onChange(defaultValue);
            }
        }
    };

    JsonString.prototype.view = React.createClass({
        handleChange: function (e) {
            this.props.validator.setData(e.target.value);
            this.props.onChange(this.props.validator);
        },

        render: function () {
            return (
                React.DOM.input(
                  {onChange:this.handleChange,
                  type:"text",
                  value:this.props.validator.value()}
                )
            );
        }
    });

    JsonText.prototype.view = React.createClass({
        handleChange: function (e) {
            this.props.validator.setData(e.target.value);
            this.props.onChange(this.props.validator);
        },

        render: function () {
            return (
                React.DOM.textarea(
                  {onChange:this.handleChange,
                  type:"text",
                  value:this.props.validator.value()}
                )
            );
        }
    });

    JsonNumber.prototype.view = React.createClass({
        handleChange: function (e) {
            var value;
            var rawValue = e.target.value;
            if (rawValue && isFinite(rawValue)) {
                value = parseFloat(rawValue);
            }
            this.props.validator.setData(value);
            this.props.onChange(this.props.validator);
        },

        render: function () {
            return (
                React.DOM.input(
                  {onChange:this.handleChange,
                  type:"text",
                  value:this.props.validator.value()}
                )
            );
        }
    });

    JsonEnum.prototype.view = React.createClass({
        handleChange: function (value) {
            this.props.validator.setData(value);
            this.props.onChange(this.props.validator);
        },

        _inputs: function () {
            // TODO: Use schema path instead of random number
            var id = Math.floor(Math.random() * 10000);
            return _.map(this.props.validator.schema.enum, function (element) {
                return (
                    React.DOM.div( {className:"json-form-row"}, 
                      React.DOM.div( {className:"json-form-control"}, 
                        React.DOM.input(
                          {type:"radio",
                          name:id,
                          checked:this.props.validator.value() == element,
                          onChange:this.handleChange.bind(this, element)}, 
                          ' ',
                          element
                        )
                      )
                    )
                );
            }, this);
        },

        render: function () {
            return (
                React.DOM.div( {className:"json-enum"}, 
                  this._inputs()
                )
            );
        }
    });

    JsonArray.prototype.view = React.createClass({
        handleNewItem: function () {
            var validator = this.props.validator;
            var items = validator.value();
            items.push(undefined);
            validator.setData(items);
            this.props.onChange(validator);
        },

        handleRemoveItem: function (i) {
            this.props.validator.removeItem(i);
            this.props.onChange(this.props.validator);
        },

        handleChangeItem: function (i, value) {
            this.props.validator.items[i] = value;
            this.props.onChange(this.props.validator);
        },

        _items: function () {
            return _.map(this.props.validator.items, function (validator, i) {
                var View = validator.view;
                return (
                    JsonFormRow(
                      {property:i,
                      onRemove:this.handleRemoveItem.bind(this, i)}, 
                      View(
                        {validator:validator,
                        onChange:this.handleChangeItem.bind(this, i)}
                      )
                    )
                );
            }, this);
        },

        _addItemButton: function () {
            var validator = this.props.validator;
            if (!validator.schema.hasOwnProperty('maxItems') ||
                validator.schema.maxItems > validator.items.length) {
                return (
                    React.DOM.li( {className:"json-form-row"}, 
                      React.DOM.div( {className:"json-form-control"}, 
                        React.DOM.button( {onClick:this.handleNewItem}, 
                          " Add item "
                        )
                      )
                    )
                );
            }
        },

        render: function () {
            return (
                React.DOM.ol( {className:"json-items"}, 
                  this._items(),
                  this._addItemButton()
                )
            );
        }
    });

    JsonObject.prototype.view = React.createClass({
        handleRemoveProperty: function (property) {
            delete this.props.validator.properties[property];
            this.props.onChange(this.props.validator);
        },

        handleChangeProperty: function (property, value) {
            this.props.validator.properties[property] = value;
            this.props.onChange(this.props.validator);
        },

        handleAddProperty: function (property) {
            var data = this.props.validator.value();
            var schema = this.props.validator.schema;
            data[property] = undefined;
            this.props.validator.setData(data);
            this.props.onChange(this.props.validator);
        },

        handleNewProperty: function () {
            this.handleAddProperty(this.refs.additionalProperty.state.value);
        },

        _propertyTags: function () {
            var validator = this.props.validator;
            var schema = validator.schema;
            if (schema.properties) {
                return _.map(schema.properties, function (subschema, key) {
                    var propertyView, onRemove;
                    if (validator.properties.hasOwnProperty(key)) {
                        var View = validator.properties[key].view;
                        propertyView =
                            View(
                              {validator:validator.properties[key],
                              onChange:this.handleChangeProperty.bind(this, key)}
                            );
                        if (!validator.required(key)) {
                            onRemove = this.handleRemoveProperty.bind(this, key);
                        }
                    }
                    else {
                        propertyView =
                            React.DOM.button(
                              {onClick:this.handleAddProperty.bind(this, key)}, 
                              " Add property "
                            );
                    }

                    return (
                        JsonFormRow(
                          {property:key,
                          label:subschema.title || key,
                          onRemove:onRemove}, 
                          propertyView
                        )
                    );
                }, this);
            }
        },

        _additionalProperties: function () {
            var validator = this.props.validator;
            var schema = validator.schema;
            return _.map(validator.properties, function (property, key) {
                if (!schema.properties ||
                    !schema.properties.hasOwnProperty(key)) {
                    var View = property.view;
                    return (
                        JsonFormRow(
                          {label:key,
                          property:key,
                          onRemove:this.handleRemoveProperty.bind(this, key)}, 
                          View(
                            {validator:property,
                            onChange:this.handleChangeProperty.bind(this, key)}
                          )
                        )
                    );
                }
            }, this);
        },

        _addPropertyButton: function () {
            if (this.props.validator.schema.additionalProperties) {
                return (
                    React.DOM.li( {className:"json-form-row"}, 
                      React.DOM.div( {className:"json-form-control"}, 
                        React.DOM.label(null, 
                          React.DOM.input( {ref:"additionalProperty", type:"text"})
                        ),
                        React.DOM.button( {onClick:this.handleNewProperty}, 
                          " Add property "
                        )
                      )
                    )
                );
            }
        },

        render: function () {
            return (
                React.DOM.ul( {className:"json-properties"}, 
                  this._propertyTags(),
                  this._additionalProperties(),
                  this._addPropertyButton()
                )
            );
        }
    });

    var JsonFormRow = React.createClass({displayName: 'JsonFormRow',
        getInitialState: function () {
            return {collapsed: true};
        },

        handleCollapse: function () {
            this.setState({collapsed: true});
        },

        handleExpand: function () {
            this.setState({collapsed: false});
        },

        _removeButton: function () {
            if (this.props.onRemove) {
                return (
                    React.DOM.button(
                      {className:"glyphicon glyphicon-remove",
                      onClick:this.props.onRemove})
                );
            }
        },

        _errorView: function (error) {
            if (error) {
                return (
                    React.DOM.span( {className:"json-form-error"}, error)
                );
            }
        },

        _label: function () {
            if (this.props.label) {
                return React.DOM.label(null, this.props.label);
            }
        },

        render: function () {
            var valueView = this.props.children;
            var validator = valueView.props.validator;
            var error = validator && validator.errors[0];
            if (!validator || validator.inline) {
                return (
                    React.DOM.li( {className:"json-form-row", key:this.props.property}, 
                      React.DOM.div( {className:"json-form-control"}, 
                        this._label(),
                        valueView,
                        ' ',
                        this._removeButton(),
                        ' ',
                        this._errorView(error)
                      )
                    )
                );
            }
            else if (this.state.collapsed) {
                return (
                    React.DOM.li( {className:"json-form-row", key:this.props.property}, 
                      React.DOM.div( {className:"json-form-control collapser"}, 
                        this._label(),
                        React.DOM.button(
                          {className:"glyphicon glyphicon-expand",
                          onClick:this.handleExpand}),
                        ' ',
                        this._removeButton(),
                        ' ',
                        this._errorView(error)
                      ),
                      React.DOM.div( {className:"collapsible collapsed"}, 
                        valueView
                      )
                    )
                );
            }
            else {
                return (
                    React.DOM.li( {className:"json-form-row", key:this.props.property}, 
                      React.DOM.div( {className:"json-form-control collapser"}, 
                        this._label(),
                        React.DOM.button(
                          {className:"glyphicon glyphicon-collapse-down",
                          onClick:this.handleCollapse}),
                        ' ',
                        this._removeButton(),
                        ' ',
                        this._errorView(error)
                      ),
                      React.DOM.div( {className:"collapsible"}, 
                        valueView
                      )
                    )
                );
            }
        }
    });

    JsonBoolean.prototype.view = React.createClass({
        handleChange: function (e) {
            this.props.validator.setData(e.target.checked);
            this.props.onChange(this.props.validator);
        },

        render: function () {
            return (
                React.DOM.input(
                  {onChange:this.handleChange,
                  type:"checkbox",
                  checked:this.props.validator.value()}
                )
            );
        }
    });

    JsonNull.prototype.view = React.createClass({
        render: function () {
            return (
                React.DOM.strong(null, "NULL")
            );
        }
    });

    var JsonForm = React.createClass({displayName: 'JsonForm',
        getInitialState: function () {
            return {validator: new JsonValidator(this.props.schema, this.props.data)};
        },

        handleChange: function (validator) {
            this.setState({validator: validator});
        },

        value: function () {
            if (this.state.validator.valid()) {
                return this.state.validator.value();
            }
        },

        render: function () {
            var View = this.state.validator.view;
            return (
                React.DOM.div(null, 
                  View(
                    {validator:this.state.validator,
                    onChange:this.handleChange}
                  ),
                  React.DOM.p(null, JSON.stringify(this.value()))
                )
            );
        }
    });

    window.JsonForm = JsonForm;
})();
