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
                <input
                  onChange={this.handleChange}
                  type="text"
                  value={this.props.validator.value()}
                />
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
                <textarea
                  onChange={this.handleChange}
                  type="text"
                  value={this.props.validator.value()}
                />
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
                <input
                  onChange={this.handleChange}
                  type="text"
                  value={this.props.validator.value()}
                />
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
                    <div className="json-form-row">
                      <div className="json-form-control">
                        <input
                          type="radio"
                          name={id}
                          checked={this.props.validator.value() == element}
                          onChange={this.handleChange.bind(this, element)}>
                          {' '}
                          {element}
                        </input>
                      </div>
                    </div>
                );
            }, this);
        },

        render: function () {
            return (
                <div className="json-enum">
                  {this._inputs()}
                </div>
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
                    <JsonFormRow
                      property={i}
                      onRemove={this.handleRemoveItem.bind(this, i)}>
                      <View
                        validator={validator}
                        onChange={this.handleChangeItem.bind(this, i)}
                      />
                    </JsonFormRow>
                );
            }, this);
        },

        _addItemButton: function () {
            var validator = this.props.validator;
            if (!validator.schema.hasOwnProperty('maxItems') ||
                validator.schema.maxItems > validator.items.length) {
                return (
                    <li className="json-form-row">
                      <div className="json-form-control">
                        <button onClick={this.handleNewItem}>
                          Add item
                        </button>
                      </div>
                    </li>
                );
            }
        },

        render: function () {
            return (
                <ol className="json-items">
                  {this._items()}
                  {this._addItemButton()}
                </ol>
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
                            <View
                              validator={validator.properties[key]}
                              onChange={this.handleChangeProperty.bind(this, key)}
                            />;
                        if (!validator.required(key)) {
                            onRemove = this.handleRemoveProperty.bind(this, key);
                        }
                    }
                    else {
                        propertyView =
                            <button
                              onClick={this.handleAddProperty.bind(this, key)}>
                              Add property
                            </button>;
                    }

                    return (
                        <JsonFormRow
                          property={key}
                          label={subschema.title || key}
                          onRemove={onRemove}>
                          {propertyView}
                        </JsonFormRow>
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
                        <JsonFormRow
                          label={key}
                          property={key}
                          onRemove={this.handleRemoveProperty.bind(this, key)}>
                          <View
                            validator={property}
                            onChange={this.handleChangeProperty.bind(this, key)}
                          />
                        </JsonFormRow>
                    );
                }
            }, this);
        },

        _addPropertyButton: function () {
            if (this.props.validator.schema.additionalProperties) {
                return (
                    <li className="json-form-row">
                      <div className="json-form-control">
                        <label>
                          <input ref="additionalProperty" type="text"/>
                        </label>
                        <button onClick={this.handleNewProperty}>
                          Add property
                        </button>
                      </div>
                    </li>
                );
            }
        },

        render: function () {
            return (
                <ul className="json-properties">
                  {this._propertyTags()}
                  {this._additionalProperties()}
                  {this._addPropertyButton()}
                </ul>
            );
        }
    });

    var JsonFormRow = React.createClass({
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
                    <button
                      className="glyphicon glyphicon-remove"
                      onClick={this.props.onRemove}/>
                );
            }
        },

        _errorView: function (error) {
            if (error) {
                return (
                    <span className="json-form-error">{error}</span>
                );
            }
        },

        _label: function () {
            if (this.props.label) {
                return <label>{this.props.label}</label>;
            }
        },

        render: function () {
            var valueView = this.props.children;
            var validator = valueView.props.validator;
            var error = validator && validator.errors[0];
            if (!validator || validator.inline) {
                return (
                    <li className="json-form-row" key={this.props.property}>
                      <div className="json-form-control">
                        {this._label()}
                        {valueView}
                        {' '}
                        {this._removeButton()}
                        {' '}
                        {this._errorView(error)}
                      </div>
                    </li>
                );
            }
            else if (this.state.collapsed) {
                return (
                    <li className="json-form-row" key={this.props.property}>
                      <div className="json-form-control collapser">
                        {this._label()}
                        <button
                          className="glyphicon glyphicon-expand"
                          onClick={this.handleExpand}/>
                        {' '}
                        {this._removeButton()}
                        {' '}
                        {this._errorView(error)}
                      </div>
                      <div className="collapsible collapsed">
                        {valueView}
                      </div>
                    </li>
                );
            }
            else {
                return (
                    <li className="json-form-row" key={this.props.property}>
                      <div className="json-form-control collapser">
                        {this._label()}
                        <button
                          className="glyphicon glyphicon-collapse-down"
                          onClick={this.handleCollapse}/>
                        {' '}
                        {this._removeButton()}
                        {' '}
                        {this._errorView(error)}
                      </div>
                      <div className="collapsible">
                        {valueView}
                      </div>
                    </li>
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
                <input
                  onChange={this.handleChange}
                  type="checkbox"
                  checked={this.props.validator.value()}
                />
            );
        }
    });

    JsonNull.prototype.view = React.createClass({
        render: function () {
            return (
                <strong>NULL</strong>
            );
        }
    });

    var JsonForm = React.createClass({
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
                <div>
                  <View
                    validator={this.state.validator}
                    onChange={this.handleChange}
                  />
                  <p>{JSON.stringify(this.value())}</p>
                </div>
            );
        }
    });

    window.JsonForm = JsonForm;
})();
