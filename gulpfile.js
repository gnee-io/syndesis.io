const gulp = require('gulp');
const plugins = require('gulp-load-plugins')();

const jsLibs = [
  './node_modules/scrollpos-styler/scrollPosStyler.js',
  './node_modules/jquery/dist/jquery.slim.min.js',
  './node_modules/tether/dist/js/tether.min.js',
  './node_modules/bootstrap/dist/js/bootstrap.min.js',
  './node_modules/anchor-js/anchor.js',
  './themes/syndesis/js/**/*.js'
];

const port = 7000;

gulp.task('css', function () {
  return gulp.src('./themes/syndesis/scss/**/*.scss')
    .pipe(plugins.sass())
    .pipe(plugins.postcss())
    .pipe(gulp.dest('./themes/syndesis/static/css'));
});

gulp.task('js', function () {
  return gulp.src(jsLibs)
    .pipe(plugins.concat('syndesis.js'))
    .pipe(gulp.dest('./themes/syndesis/static/js'));
});

gulp.task('fonts', function() {
  return gulp.src('./node_modules/@fortawesome/fontawesome-free/webfonts/*')
    .pipe(gulp.dest('./themes/syndesis/static/fonts'));
});

gulp.task('hugo', function (cb) {
  const exec = require('child_process').exec;

  const githubProject = process.env['CIRCLE_PROJECT_USERNAME'];
  let baseURLArg = '';
  if (githubProject && githubProject !== "syndesisio" && process.env['CIRCLE_PROJECT_REPONAME']) {
    baseURLArg = ' --baseURL https://' + githubProject + '.github.io/' + process.env['CIRCLE_PROJECT_REPONAME'] + '/';
  }

  exec('hugo' + baseURLArg, function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('hugo:serve', function (cb) {
  const exec = require('child_process').exec;

  console.log('\n' +
    '     _______.____    ____ .__   __.  _______   _______     _______. __       _______.\n' +
    '    /       |\\   \\  /   / |  \\ |  | |       \\ |   ____|   /       ||  |     /       |\n' +
    '   |   (----` \\   \\/   /  |   \\|  | |  .--.  ||  |__     |   (----`|  |    |   (----`\n' +
    '    \\   \\      \\_    _/   |  . `  | |  |  |  ||   __|     \\   \\    |  |     \\   \\    \n' +
    '.----)   |       |  |     |  |\\   | |  \'--\'  ||  |____.----)   |   |  | .----)   |   \n' +
    '|_______/        |__|     |__| \\__| |_______/ |_______|_______/    |__| |_______/    \n' +
    '                                                                                     \n' +
    '');

  console.log('SYNDESIS is now running on port ' + port);
  exec('hugo serve --port ' + port + ' --bind 0.0.0.0', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('optimize-css', function() {
  return gulp.src(['./public/**/*.css'])
    .pipe(plugins.uncss({
      html: ['./public/**/*.html'],
      ignore: [/^\.sps.*/, /\.collapse\.show$/, /\.collapsing$/, '.sidenav.active', '.anchorjs-icon']
    }))
    .pipe(gulp.dest('./public'));
});

gulp.task('optimize-html', function() {
  return gulp.src(['./public/**/*.html'])
    .pipe(plugins.cacheBust({
      type: 'timestamp'
    }))
    .pipe(plugins.htmlmin({
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      minifyURLs: true,
      removeComments: true
    }))
    .pipe(gulp.dest('./public'));
});

gulp.task('optimize-js', function() {
  return gulp.src(['./public/**/*.js'])
    .pipe(plugins.uglify())
    .pipe(gulp.dest('./public'));
});

gulp.task('watch', gulp.parallel(function() {
  console.log('Watching for changes...');

  gulp.watch('./themes/syndesis/scss/**/*.scss').on('change', function() {
    console.log('Rebuilding CSS...');
    gulp.task('css');
  });

  gulp.watch(jsLibs).on('change', function() {
    console.log('Rebuilding JS...');
    gulp.series('js');
  });
}));

gulp.task('optimize', gulp.series('optimize-html', 'optimize-css', 'optimize-js'));

gulp.task('manual:export', (cb) => {
  const svn  = require('node-svn-ultimate');
  return svn.commands.export('https://github.com/syndesisio/syndesis/trunk/doc', 'build/documentation', {
    quiet: true,
    force: true
  }, cb)
});

gulp.task('manual:render', (cb) => {
  const Asciidoctor = require('asciidoctor.js');
  const asciidoctor = Asciidoctor();

  const logger = asciidoctor.MemoryLogger.$new();
  asciidoctor.LoggerManager.setLogger(logger);

  const registry = asciidoctor.Extensions.create();
  require('./asciidoc-processor.js')(registry);

  const sections = ['tutorials', 'integrating-applications', 'connecting', 'developing_extensions', 'managing_environments'];

  for (const section of sections) {
    asciidoctor.convertFile(`build/documentation/${section}/master.adoc`, {
      'doctype': 'book',
      'safe': 'safe',
      'mkdirs': true,
      'to_file': `documentation/manual/${section}/index.html`,
      'attributes': {
        'linkcss': true,
        'stylesheet': '/css/syndesis.css'
      },
      'extension_registry': registry
    });

    const messages = logger.getMessages();
    const hasErrors = messages.find(m => m.severity === 'ERROR');

    if (hasErrors) {
      const text = messages
        .map(m => `${m.severity}: ${m.message['text']}`)
        .join('\n');
      cb(new Error(text));
    }
  }

  cb();
});

gulp.task('serve', gulp.parallel('watch', 'hugo:serve'));
gulp.task('manual', gulp.series('manual:export', 'manual:render'));
gulp.task('build', gulp.series('manual', 'fonts', 'css', 'js', 'hugo', 'optimize'));
gulp.task('default', gulp.series(gulp.parallel('manual', 'js', 'css'), gulp.parallel('hugo:serve', 'watch')));
