/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const Promise = require('promise');

const writeFile = require('../writeFile');
const writeSourceMap = require('./write-sourcemap');
const MODULES_DIR = 'js-modules';

/**
 * Saves all JS modules of an app as single files
 * The startup code (prelude, polyfills etc.) are written to the file
 * designated by the `bundleOuput` option.
 * All other modules go into a 'js-modules' folder that in the same parent
 * directory as the startup file.
 */
function saveAsAssets(bundle, options, log) {
  const {
    'bundle-output': bundleOutput,
    'bundle-encoding': encoding,
    dev,
    'sourcemap-output': sourcemapOutput,
  } = options;

  log('start');
  const {startupCode, modules} = bundle.getUnbundle({minify: !dev});
  log('finish');

  log('Writing bundle output to:', bundleOutput);
  const writeUnbundle =
    Promise.all([
      writeModules(path.dirname(bundleOutput), modules, encoding),
      writeStartupFile(bundleOutput, startupCode, encoding)
    ]);
  writeUnbundle.then(() => log('Done writing unbundle output'));

  return Promise.all([writeUnbundle, writeSourceMap(sourcemapOutput, '', log)]);
}

function createDir(dirName) {
  return new Promise((resolve, reject) =>
    mkdirp(dirName, error => error ? reject(error) : resolve()));
}

function createDirectoriesForModules(modulesDir, modules) {
  const dirNames =
    modules.map(name => {
      // get all needed directory names
      const dir = path.dirname(name);
      return dir === '.' ? modulesDir : path.join(modulesDir, dir);
    })
    .filter(Boolean) // remove empty directories
    .sort()
    .filter((dir, i, dirs) => {
      // remove parent directories. After sorting, parent directories are
      // located before child directories
      const next = dirs[i + 1];
      return !next || next !== dir && !next.startsWith(dir + path.sep);
    });

  return dirNames.reduce(
    (promise, dirName) =>
      promise.then(() => createDir(dirName)), Promise.resolve());
}

function writeModuleFile(module, modulesDir, encoding) {
  const {name, code} = module;
  return writeFile(path.join(modulesDir, name + '.js'), code, encoding);
}

function writeModuleFiles(modules, modulesDir, encoding) {
  const writeFiles =
    modules.map(module => writeModuleFile(module, modulesDir, encoding));
  return Promise.all(writeFiles);
}

function writeModules(assetsDest, modules, encoding) {
  const modulesDir = path.join(assetsDest, MODULES_DIR);

  return (
    createDirectoriesForModules(modulesDir, modules.map(({name}) => name))
      .then(() => writeModuleFiles(modules, modulesDir, encoding))
  );
}

function writeStartupFile(outputFile, code, encoding) {
  return new Promise((resolve, reject) => {
    fs.createWriteStream(outputFile).
      write(code, encoding, error => error ? reject(error) : resolve());
  });
}

module.exports = saveAsAssets;
