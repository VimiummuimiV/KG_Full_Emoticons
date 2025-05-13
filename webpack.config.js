import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import TerserPlugin from 'terser-webpack-plugin';

export default (_env, argv) => {
  const isProduction = argv.mode === 'production';
  const headersPath  = resolve(import.meta.dirname, 'src/header.js');
  const outputPath   = resolve(import.meta.dirname, 'dist/KG_Full_Emoticons.js');

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/main.js',
    output: {
      path: resolve(import.meta.dirname, 'dist'),
      filename: 'KG_Full_Emoticons.js',
    },
    module: {
      rules: [
        // 1) plain CSS
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            'css-loader',
          ],
        },
        // 2) SCSS/SASS
        {
          test: /\.s[ac]ss$/i,
          use: [
            'style-loader',
            'css-loader',
            'sass-loader',
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.json', '.css', '.scss', '.sass'],
    },
    optimization: {
      minimize: isProduction,
      minimizer: [new TerserPlugin()],
    },
    stats: 'minimal',
    plugins: [
      {
        apply: (compiler) => {
          compiler.hooks.afterEmit.tap('AppendTampermonkeyHeader', () => {
            try {
              const header = readFileSync(headersPath, 'utf8').trim();
              const script = readFileSync(outputPath, 'utf8');
              writeFileSync(outputPath, `${header}\n\n${script}`);
            } catch (error) {
              console.error('Error appending Tampermonkey headers:', error);
            }
          });
        },
      },
    ],
  };
};
