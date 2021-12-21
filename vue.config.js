const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const WindiCSSWebpackPlugin = require("windicss-webpack-plugin");

module.exports = {
  publicPath: "/",
  productionSourceMap: false,
  devServer: {
    writeToDisk: true
  },
  lintOnSave: false,
  // filenameHashing: false,
  // chainWebpack: (config) => {
  //   config.optimization.delete("splitChunks");
  // },
  configureWebpack: {
    devtool: "cheap-module-source-map"
  },
  chainWebpack: config => {
    config.plugin("clean-output").use(
      new CleanWebpackPlugin({
        cleanStaleWebpackAssets: false
      })
    );

    config.plugin("windicss").use(new WindiCSSWebpackPlugin());
  }
};
