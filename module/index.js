const { resolve, join } = require('path')
const { existsSync, readdirSync } = require('fs')
const merge = require('lodash/merge')
const filter = require('lodash/filter')
const consola = require('consola')
const defaults = require('./defaults')
const logger = consola.withScope('nuxt-jsorm')

module.exports = function (moduleOptions) {
  // Merge all option sources
  const options = merge({}, defaults, moduleOptions, this.options.orm)
  options.modelsRoot = resolve(this.options.srcDir, options.modelsRoot)
  options.authTokenKey = this.options.auth.token.prefix + options.authStrategy

  // Validate and Normalize options
  validateOptions.call(this, options)

  // Process and normalize models
  options.models = processModels.call(this, options)

  // Copy plugin
  copyPlugin.call(this, options)
}

function validateOptions(options) {
  if (!existsSync(options.modelsRoot)) {
    logger.fatal(`No models found in ${options.modelsRoot}.`)
  }
  if (typeof options.parentModel === 'undefined') {
    logger.fatal('No parentModel defined.')
  }
}

function copyPlugin(options) {
  // Copy orm plugin
  const { dst } = this.addTemplate({
    src: resolve(__dirname, 'plugin.js'),
    fileName: join('orm', 'plugin.js'),
    options
  })
  if (!this.options.auth.plugins) this.options.auth.plugins = []
  this.options.auth.plugins.push(resolve(this.options.buildDir, dst))
}

function processModels(options) {
  const models = []

  if (!existsSync(options.modelsRoot)) {
    logger.fatal('No models found.')
  }

  for (const file of readdirSync(options.modelsRoot)) {
    const fileNameWithoutExtension = file.split('.').slice(0, -1).join('.')
    models.push({
      model: fileNameWithoutExtension,
      path: resolve(options.modelsRoot, file),
      base: (fileNameWithoutExtension === options.parentModel)
    })
  }
  if (filter(models, o => o.model === options.parentModel).length < 1) { logger.fatal(`No ${options.parentModel} model found.`) }

  return models
}