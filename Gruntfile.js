'use strict';

module.exports = function (grunt) {

  grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      react: {
          compile: {
              files: {
                  'json-form.js': [
                      'js/json-validator.js',
                      'js/json-form.react.jsx'
                  ]
              }
          }
      },
      uglify: {
          compress: {
              files: {
                  'json-form.min.js': ['json-form.js']
              }
          }
      },
      connect: {
          options: {
              port: 9000,
              hostname: 'localhost'
          },
          demo: {
              options: {
                  open: true,
                  keepalive: true
              }
          }
      }
  });

  grunt.loadNpmTasks('grunt-react');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', ['react', 'uglify']);
};
