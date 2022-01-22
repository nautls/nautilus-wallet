const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const WindiCSSWebpackPlugin = require("windicss-webpack-plugin");
var webpack = require("webpack");

module.exports = {
  publicPath: "/",
  productionSourceMap: false,
  devServer: {
    writeToDisk: true
  },
  lintOnSave: false,
  configureWebpack: {
    devtool: "none"
  },
  pages: {
    index: { entry: "src/main.ts", template: "public/index.html", title: "Nautilus" },
    background: { entry: "src/background.ts", template: "public/background.html" }
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
