(function(angular) {
  // Add disqus as dependency
  var module = angular.module('demoApp', [ 'ngRoute', 'ngDisqus' ]);

  module.config(function($disqusProvider, $locationProvider, $routeProvider) {
    $disqusProvider.setShortname('angulardisqusdemo'); // Configure the disqus shortname
    $locationProvider.hashPrefix('!');                 // Disqus needs hashbang in urls. If you are using pushstate then no need for this.
    // Configure your amazing routes
    $routeProvider.when('/test/:id', {
      templateUrl : 'app/partials/testTpl.html',
      controller  : 'TestCtrl'
    }).when('/contributors', {
      templateUrl : 'app/partials/contributorsTpl.html',
      controller  : 'ContributorsCtrl'
    }).when('/index', {
      templateUrl : 'app/partials/indexTpl.html'
    }).otherwise({
      redirectTo : '/index'
    });
  });

  // Test page controller
  module.controller('TestCtrl', function($scope, $routeParams) {
    $scope.id = $routeParams.id;
  });

  module.controller('ContributorsCtrl', function($http, $scope) {
    $scope.contributors = []; // Contributors placeholder
    $http.get('https://api.github.com/repos/kirstein/angular-disqus/contributors').success(function(data) {
      $scope.contributors = data;
    });
  });

})(angular);