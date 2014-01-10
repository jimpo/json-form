describe('JsonNull', function () {
    var schema = {
        type: 'null',
    };
    var validator = new JsonNull(schema);

    describe('#setData()', function () {
        it('should have the setData method', function () {
            validator.should.respondTo('setData');
        });
    });

    describe('#valid()', function () {
        it('should always be true', function() {
            validator.valid().should.be.true;
        });
    });

    describe('#value()', function () {
        it('should always be null', function(){
            expect(validator.value()).to.be.null;
        });
    });
});

describe('JsonBoolean', function () {
    var schema = {
        type: 'boolean'
    };

    describe('#setData()', function () {
        it('should change the value', function () {
            var validator = new JsonBoolean(schema, false);
            validator.setData(true);
            validator.valid().should.be.true;
        });
    });

    describe('#valid()', function () {
        it('should always be true', function() {
            var validator = new JsonBoolean(schema, true);
            validator.valid().should.be.true;

            var validator = new JsonBoolean(schema, false);
            validator.valid().should.be.true;
        });
    });

    describe('#value()', function () {
        it('should default to false', function () {
            var validator = new JsonBoolean(schema);
            validator.value().should.be.false;
        });

        it('should equal given value', function() {
            var validator = new JsonBoolean(schema, true);
            validator.value().should.be.true;

            var validator = new JsonBoolean(schema, false);
            validator.value().should.be.false;
        });

        describe('when a default value is set', function () {
            var schema = {
                type: 'boolean',
                default: true
            };

            it('should default to given default', function () {
                var validator = new JsonBoolean(schema);
                validator.value().should.be.true;
            });
        });
    });
});

describe('JsonString', function () {
    var schema = {
        type: 'string'
    };

    describe('#setData()', function () {
        it('should change the value', function () {
            var validator = new JsonString(schema, 'Homer');
            validator.setData('Bart');
            validator.value().should.equal('Bart');
        });
    });

    describe('#value()', function () {
        it('should default to the empty string', function () {
            var validator = new JsonString(schema);
            validator.value().should.equal('');
        });

        it('should equal given value', function() {
            var validator = new JsonString(schema, 'Homer');
            validator.value().should.equal('Homer');
        });

        describe('when a default value is set', function () {
            var schema = {
                type: 'string',
                default: 'Bart',
            };

            it('should default to given default', function () {
                var validator = new JsonString(schema);
                validator.value().should.equal('Bart');
            });
        });
    });

    describe('#valid()', function () {
        it('should validate the minLength', function () {
            var validator = new JsonString({
                type: 'string',
                minLength: 6,
            });
            validator.setData('Homer').valid().should.be.false;
            validator.setData('Maggie').valid().should.be.true;
        });

        it('should validate the maxLength', function () {
            var validator = new JsonString({
                type: 'string',
                maxLength: 5,
            });
            validator.setData('Homer').valid().should.be.true;
            validator.setData('Maggie').valid().should.be.false;
        });

        it('should validate the pattern', function () {
            var validator = new JsonString({
                type: 'string',
                pattern: '\\d+',
            });
            validator.setData('Homer').valid().should.be.false;
            validator.setData('1234').valid().should.be.true;
        });
    });
});

describe('JsonNumber', function () {
    var schema = {
        type: 'number'
    };

    describe('#setData()', function () {
        it('should change the value', function () {
            var validator = new JsonNumber(schema);
            validator.setData(2.71).value().should.equal(2.71);
        });
    });

    describe('#value()', function () {
        it('should equal given value', function() {
            var validator = new JsonNumber(schema, 3);
            validator.value().should.equal(3);
        });

        describe('when a default value is set', function () {
            var schema = {
                type: 'number',
                default: 4,
            };

            it('should default to given default', function () {
                var validator = new JsonString(schema);
                validator.value().should.equal(4);
            });
        });
    });
});
