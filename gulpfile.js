const { series, parallel, src, dest, watch } = require('gulp');
const browserSync = require('browser-sync').create();
const reload = browserSync.reload;
const del = require('del');
const sass = require('gulp-sass');
const plumber = require('gulp-plumber');
const autoprefixer = require('gulp-autoprefixer');
const babel = require('gulp-babel');
const prettier = require('gulp-prettier');
const sourcemaps = require('gulp-sourcemaps');
// const ghPages = require('gulp-gh-pages');


// gulp.task('deploy', () => {
//   return gulp.src('./public/**/*').pipe($.ghPages());
// });

// exports.deploy = deploy;

function css() {
  return src('src/scss/**/*.scss')
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(
      sass({
        outputStyle: 'compact',
        includePaths: [''],
      }).on('error', sass.logError)
    )
    .pipe(autoprefixer())
    .pipe(dest('dist/css'));
}

function js() {
  return src('src/js/*.js')
    .pipe(plumber())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(babel({ presets: ['@babel/env'] }))
    .pipe(sourcemaps.write())
    .pipe(dest('dist/js'));
}

function html() {
  return src('src/**/!(_)*.html').pipe(plumber()).pipe(dest('./dist'));
}

function clean() {
  return del(['dist/**']).then(() => {
    console.log('init...');
  });
}

function watchList() {
  browserSync.init({
    server: {
      baseDir: 'dist',
    },
    port: 5000,
  });

  watch(['src/scss/**/*.scss'], series(css));
  watch(['src/js/**/*.js'], series(js));
  watch(['src/**/*.html'], series(html));
  watch(['src/**']).on('unlink', series(clean, parallel(css, js, html)));
  watch(['dist/**']).on('change', reload);
}

exports.watch = watchList;
