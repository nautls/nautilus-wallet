const path = require("path");
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
    index: { entry: "src/main.ts", template: "public/index.html", title: "Nautilus" },
    background: { entry: "src/background/background.ts", template: "public/background.html" }
  },
  chainWebpack: (config) => {
    config.module
      .rule("ergo-market-lib")
      .test({
        test: /\.js$/,
        include: path.join(__dirname, "node_modules/ergo-market-lib/dist")
      })
      .use("babel-loader")
      .loader("babel-loader")
      .options({
        plugins: ["@babel/plugin-proposal-optional-chaining"]
      })
      .end();

    config
      .entry("injector")
      .add("./src/content-scripts/injector.js")
      .end()
      .optimization.splitChunks(false)
      .end()
      .output.filename("js/[name].js")
      .chunkFilename("js/[name].js")
      .end();

    config
      .plugin("clean-output")
      .use(
        new CleanWebpackPlugin({
          cleanStaleWebpackAssets: false
        })
      )
      .end();

    config.plugin("windicss").use(new WindiCSSWebpackPlugin()).end();
  }
};
