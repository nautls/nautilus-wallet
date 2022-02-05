const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const WindiCSSWebpackPlugin = require("windicss-webpack-plugin");

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
    index: { entry: "src/main.ts", template: "public/index.html", title: "Nautilus Wallet" },
    background: { entry: "src/background/background.ts", template: "public/background.html" }
  },
  chainWebpack: (config) => {
    config.plugin("clean-output").use(
      new CleanWebpackPlugin({
        cleanStaleWebpackAssets: false
      })
    );

    config.plugin("copy").tap(([pathConfigs]) => {
      pathConfigs.push({
        from: "src/content-scripts",
        to: "js"
      });

      return [pathConfigs];
    });

    config.plugin("windicss").use(new WindiCSSWebpackPlugin());
  }
};
