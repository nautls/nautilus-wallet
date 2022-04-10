const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const WindiCSSWebpackPlugin = require("windicss-webpack-plugin");
const webpack = require("webpack");

const commitHash = require("child_process").execSync("git rev-parse HEAD").toString().trim();

module.exports = {
  publicPath: "/",
  productionSourceMap: false,
  devServer: {
    writeToDisk: true
  },
  lintOnSave: false,
  configureWebpack: {
    devtool: "none",
    optimization: {
      splitChunks: {
        chunks: "all"
      }
    }
  },
  pages: {
    index: { entry: "src/main.ts", template: "public/index.html", title: "Nautilus" },
    background: { entry: "src/background/background.ts", template: "public/background.html" }
  },
  transpileDependencies: ["ergo-market-lib"],
  chainWebpack: (config) => {
    config.output.filename("js/[name].js").chunkFilename("js/[name].js").end();

    config.plugin("copy").tap(([pathConfigs]) => {
      pathConfigs.push({
        from: "src/content-scripts",
        to: "js"
      });

      return [pathConfigs];
    });

    config.plugin("define").tap((options) => {
      options[0]["process.env"].GIT_HASH = JSON.stringify(commitHash);
      options[0]["process.env"].MAINNET = JSON.stringify(!process.argv.includes("--testnet"));
      return options;
    });

    config
      .plugin("ignore")
      .use(new webpack.IgnorePlugin(/^\.\/wordlists\/(?!english)/, /bip39\\src$/));

    config
      .plugin("clean-output")
      .use(
        new CleanWebpackPlugin({
          cleanStaleWebpackAssets: false
        })
      )
      .end();

    const svgRule = config.module.rule("svg");
    svgRule.uses.clear();
    svgRule
      .use("vue-loader")
      .loader("vue-loader-v16")
      .end()
      .use("vue-svg-loader")
      .loader("vue-svg-loader")
      .end();

    config.plugin("windicss").use(new WindiCSSWebpackPlugin()).end();
  }
};
