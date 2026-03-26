import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const isProd = process.env.NODE_ENV === 'production';

export default {
  input: 'src/embed.js',
  output: {
    file: 'dist/embed.js',
    format: 'iife',
    name: 'WebPin',
    sourcemap: !isProd,
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    isProd && terser(),
  ].filter(Boolean),
};
