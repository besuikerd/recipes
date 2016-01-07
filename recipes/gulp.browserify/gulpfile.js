var gulp        = require('gulp');
var sass        = require('gulp-sass');
var gutil       = require('gulp-util');
var concat      = require('gulp-concat');
var source      = require('vinyl-source-stream');
var babelify    = require('babelify');
var watchify    = require('watchify');
var exorcist    = require('exorcist');
var browserify  = require('browserify');
var browserSync = require('browser-sync').create();
var _ = require('lodash');
var fs = require('fs');
var nodeResolve = require('resolve');

var production = (process.env.NODE_ENV === 'production');

var rootPath = 'src/main'
var src = {
    scss:   `${rootPath}/styles/**/*.scss`,
    css:    `${rootPath}/dist/styles/`,
    js:     `${rootPath}/js/`,
    jsMain: `${rootPath}/js/app.js`,
    html:   `${rootPath}/**/*.html`,
    dist:   `${rootPath}/dist/`
}

// Input file.
watchify.args.debug = !production;
var bundler = watchify(browserify(`./${src.jsMain}`, watchify.args))
    .transform(babelify.configure({
        sourceMapRelative: src.js
    }));

// On updates recompile
bundler.on('update', bundle);

function bundle() {

    gutil.log('Compiling JS...');

    return bundler.bundle()
        .on('error', function (err) {
            gutil.log(err.message);
            browserSync.notify("Browserify Error!");
            this.emit("end");
        })
        .pipe(exorcist(`${src.dist}/js/bundle.js.map`))
        .pipe(source('js/bundle.js'))
        .pipe(gulp.dest(src.dist))
        .pipe(browserSync.stream({once: true}));
}

/**
 * Gulp task alias
 */
gulp.task('bundle', ['build-vendor-js'], function () {
    return bundle();
});

/**
 * First bundle, then serve from the ./app directory
 */
gulp.task('default', ['build-vendor-js', 'build-vendor-css', 'sass', 'bundle'], function () {
    gulp.watch(src.scss, ['sass']);
    gulp.watch(src.html).on('change', browserSync.reload);

    browserSync.init({
        server: {
            baseDir: rootPath
        },
        browser: [] //do not open a browser tab
    });
});

gulp.task('sass', function(){
    return gulp.src(src.scss)
        .pipe(sass())
        .pipe(gulp.dest(src.css))
        .pipe(browserSync.reload({stream:true}))
})


gulp.task('build-vendor-js', function () {

  // this task will go through ./bower.json and
  // uses bower-resolve to resolve its full path.
  // the full path will then be added to the bundle using require()

  var b = browserify({
    // generate source maps in non-production environment
    debug: !production
  });

  // get all bower components ids and use 'bower-resolve' to resolve
  // the ids to their full path, which we need for require()
  getBowerPackageIds().forEach(function (path) {
    
    var exposeId = /([^/]+).js$/.exec(path)[0].stripExtension();
    var fullPath = `./bower_components/${path}`;
    b.require(fullPath, {

      // exposes the package id, so that we can require() from our code.
      // for eg:
      // require('./vendor/angular/angular.js', {expose: 'angular'}) enables require('angular');
      // for more information: https://github.com/substack/node-browserify#brequirefile-opts
      expose: exposeId

    });
  });
  
  getNPMPackageIds().forEach(function (id) {
    b.require(nodeResolve.sync(id), { expose: id });
  });

  return b
    .bundle()
    .on('error', function(err){
      // print the error (can replace with gulp-util)
      console.log(err.message);
      // end this stream
      this.emit('end');
    })
    // .pipe(exorcist(`${src.dist}/vendor.js.map`))
    .pipe(source('js/vendor.js'))
    .pipe(gulp.dest(src.dist));
});

gulp.task('build-vendor-css', function(){
    return gulp.src('bower_components/**/*.css')
        .pipe(concat('styles/vendor.css'))
        .pipe(gulp.dest(src.dist))
});

function getBowerPackageIds() {
  // read bower.json and get dependencies' package ids
  var bowerManifest = {};
  try {
    bowerManifest = require('./bower.json');
    var dependencies = _.keys(bowerManifest.dependencies) || [];
    var subDependencies = dependencies.map(function(dep){
        var modules = [dep];
        try{
            var mainConfig = require(`./bower_components/${dep}/bower.json`).main
            if(typeof(mainConfig) === 'string'){
                modules = [mainConfig];
            } else if(typeof(mainConfig) === 'object'){
                modules = mainConfig;
            }
        } catch(e){
            //no bower.json in module, which should not be possible
        }
        return modules.map(function(module){
            return `${dep}/${module}`
        }).filter(function(module){
            return module.endsWith('.js');
        });
    });
    return _.flatten(subDependencies)
  } catch (e) {
    // does not have a bower.json manifest
  }
}


function getNPMPackageIds() {
  // read package.json and get dependencies' package ids
  var packageManifest = {};
  try {
    packageManifest = require('./package.json');
  } catch (e) {
    // does not have a package.json manifest
  }
  return _.keys(packageManifest.dependencies) || [];

}

String.prototype.stripExtension = function(){
    return this.replace(/\.[^/.]+$/, "")
}
