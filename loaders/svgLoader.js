const { optimize } = require("svgo");

module.exports = function inlineSvgLoader(svg) {
  const { svgo: svgoConfig } = this.getOptions() || {};
  if (svgoConfig !== false) {
    ({ data: svg } = optimize(svg, {
      path: this.resourcePath,
      ...svgoConfig
    }));
  }

  return `<template>${svg}</template>`;
};
