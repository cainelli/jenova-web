(function(){
  var app = angular.module("jenovaApp");

  function clientCtrl($scope, $location, $rootScope, $state, resource, Dialog, mdToast){
    $scope.clients = [];
    var resellerName = '';
    var clientName = '';
    $scope.currentUser = $rootScope._userData.user;

    //Permissions
    
    $scope.isAdmin = userData.user.admin || userData.user.global_admin;
    $scope.isDeleteClientEnabled = isDeleteClientEnabled();
    $scope.isEditClientEnabled = isEditClientEnabled();
    $scope.isWriteClientEnabled = isWriteClientEnabled();
    
    function isEditClientEnabled(){
      if (userData.user.global_admin){
        return true;
      }
      
      // reseller admin with proper permission
      result = $scope.isAdmin && userData.permissions.users.edit;
      if (result){
        return true;
      }
      return false;
    }

    function isDeleteClientEnabled(){
      if (userData.user.global_admin){
        return true;
      }
      
      // reseller admin with proper permission
      result = $scope.isAdmin && userData.permissions.users.write;
      if (result){
        return true;
      }
      return false;
    }

    function isWriteClientEnabled(){
      if (userData.user.global_admin){
        return true;
      }
      
      // reseller admin with proper permission
      result = $scope.isAdmin && userData.permissions.users.write;
      if (result){
        return true;
      }
      return false;
    }

    $scope.isMainMenu = false;
    $scope.clientBodyMenu = false;
    $scope.selected = [];
    var clientResource = resource.clients;

    if ($rootScope._userData.user.global_admin){
      resellerName = '';
      // Global Admin
      clientResource.resellers.get({resellerName : resellerName}, function(data){
        var clients = [];
        $scope.clientBodyMenu = true;
        // ng-repeat expect an array, otherwise will fail
        if (!Array.isArray(data.response.resellers)){
          clients = [data.response.resellers];
        }        

        for (ridx in data.response.resellers){
          var resellers = data.response.resellers[ridx];
          for (cidx in resellers.clients){
            var client = resellers.clients[cidx];
            clients.push(client);
          }
        }
        $scope.clients = clients;
        $scope.clients.$resolved = data.$resolved;
        if ($scope.clients.length == 0){
          $scope.clientBodyMenu = false
        }
      }, function(data){
        $scope.clients.$resolved = true;
        console.log('Error loading clients. See response below...');
        console.log(data);
        mdToast.show(mdToast.getSimple(data.status + ' - Não foi possível obter a lista de clientes', 4000));
      });
    }else {
      if ( $rootScope._userData.user.reseller ){
        resellerName = $rootScope._userData.user.reseller.name;
      }else{
        resellerName = $rootScope._userData.user.client.reseller.name;
      }
      // Reseller
      clientResource.clients.get({resellerName : resellerName}, function(data){
        var clients = [];
        // ng-repeat expect an array, otherwise will fail
        if (!Array.isArray(data.response.resellers)){
          clients = [data.response.resellers];
        }
        
        for (cidx in data.response.clients){
          var client = data.response.clients[cidx];
          clients.push(client);
        }

        $scope.clients = clients;
        $scope.clients.$resolved = data.$resolved;
        if (data.$resolved){
          $scope.clientBodyMenu = true;
        }

      }, function(data){
        $scope.clients.$resolved = true;
        console.log('Error loading clients. See response below...');
        console.log(data);
        mdToast.show(mdToast.getSimple(data.status + ' - Não foi possível obter a lista de clientes', 4000));

      });
    }
    $scope.filter = {
      options: {
        debounce: 500
      }
    };
    $scope.query = {
      filter: '',
      order: 'name',
      limit: 5,
      page: 1
    };

    $scope.deleteClient = function(client){
      $scope.clients.$resolved = false;
      pathParams = {resellerName : client.reseller, clientName : client.name}
      clientResource.clients.delete(pathParams, function(data){
        $scope.clients.$resolved = data.$resolved;
        console.log('delete sucessfully');
        $state.reload();  
      }, function(data){
        console.log('Error deleting client. See response below...');
        console.log(data);
        $scope.clients.$resolved = true;
        var msg = data.status + ' - Não foi possível excluir o cliente: ';
        if (data.status == 403){
          msg += 'Permissão negada';
        }else if (data.status == 409){
          msg += 'Há domínios associados ao cliente';
        }else{
          msg += 'Erro desconhecido';
        }
        mdToast.show(mdToast.getSimple(msg, 5000));
      });      
    }

    $scope.removeMainMenu = function(){
      $scope.isMainMenu = false;
      $scope.currentClient = null;
    }

    $scope.removeFilter = function () {
      $scope.filter.show = false;
      $scope.query.filter = '';
      
      if($scope.filter.form.$dirty) {
        $scope.filter.form.$setPristine();
      }
    }

    $scope.showMainMenu = function(client){
      $scope.currentClient = client;
      $scope.removeFilter();
      $scope.isMainMenu = true;
      $scope.clientBodyMenu = true;
    }

    $scope.focusSearch = function(){
      $scope.focusOn = true;
      return $scope.focusOn;
    }

    $scope.openDialog = function(template_url, data) {
      //var url = 'app/components/client/client-diag.tmpl.html',
      Dialog.open(template_url, 'clientDialogCtrl', data);
    }

    $scope.goToDomain = function(client){
      
      return $location.path('/client/' + client.name + '/domains');
    }
  }

  /**
  * DIALOG CONTROLLER 
  **/
  function clientDialogCtrl($scope, $mdDialog, $rootScope, $q, $state, data, resource, mdToast){
    // All perms off on new user creation
    $scope.newClient = { restrictAccess : true }
    $scope.currentUser = $rootScope._userData.user;
    // Create client does not have any data
    $scope.currentClient = {};
    if (data){
      $scope.currentClient = JSON.parse(JSON.stringify(data));
      $scope.currentClient.$resolved = false;
    }
    $scope.selectedItem  = null;
    $scope.searchText    = null;
    $scope.querySearch   = querySearch;
    var clientResource = resource.clients;
    var userResource = resource.users;

    $scope.checkLogin = function(){
      $scope.userForm.login.$setValidity("loginInUse", true);
      userResource.get({userName : $scope.newClient.login}, function(data){
        $scope.userForm.login.$setValidity("loginInUse", false);
      });
    }

    $scope.closeDialog = function() {
      $mdDialog.hide();
    }

    function querySearch(query){
      // prevent duplicated search when selecting the result
      if ($scope.searched){
        return {};
      }
      var defer = $q.defer();
      searchResellers(query).$promise.then(function(data){
        defer.resolve(data.response);
        return data.response;
      });
      $scope.searched = true;
      return defer.promise;
    }

    function searchResellers(query) {
      var results = [];
      // Global Admin query (get all resellers/clients)
      resellerName = '' 
      // It is not a global admin user, it must belong to a client or reseller
      if (!$rootScope._userData.user.global_admin){
        resellerName = $rootScope._userData.user.reseller || $rootScope._userData.user.client.reseller.name
      }
      
      return clientResource.resellers.get({resellerName : resellerName}, function(data){
        resellers = [];
        for (ridx in data.response.resellers){
          var reseller = data.response.resellers[ridx];
          resellers.push(reseller.name);
        }

        data.response = resellers.map(function(r){
          return {
            value : r.toLowerCase(),
            display : r
          };
        }).filter(createFilterFor(query));

      }, function(data){
        console.log('Error searching resellers. See response below...');
        console.log(data);
      });
    }

    $scope.saveCreateDialog = function(){
      $scope.newClient.$resolved = true;
      var updateData = {
        login : $scope.newClient.login,
        login_name : $scope.newClient.login_name,
        email : $scope.newClient.email,
        password : $scope.newClient.password1,
        company : $scope.newClient.company,
        enable_api : $scope.newClient.enableapi,
        admin : $scope.newClient.admin
      }

      var resellerName = ''
      if ( $scope.currentUser.reseller ){
        resellerName = $scope.currentUser.reseller.name;
      }

      if ( $scope.newClient.reseller ){
        resellerName = $scope.newClient.reseller.value;
      }

      pathParams = { resellerName : resellerName, clientName : $scope.newClient.name };

      console.log(pathParams);
      console.log(updateData);
      clientResource.clients.create(pathParams, updateData, function(data){
        console.log('Create client sucessfully.');
        $state.reload();
        $mdDialog.hide();
      }, function(data){
        $scope.newClient.$resolved = false;
        console.log('Error creating client. See response below...');
        console.log(data);
        mdToast.show(mdToast.getSimple(data.status + ' - Erro ao criar cliente.', 4000));
      });      
    }

    $scope.saveEditDialog = function(client){
      if (typeof client.reseller === 'object'){
        client.reseller = client.reseller.display;
      }
      $scope.currentClient.$resolved = true;
      updateData = {
        company : client.company,
        phone : client.phone,
        email : client.email,
        reseller_name : client.reseller
      }

      if (!$rootScope._userData.user.global_admin){
        // A global admin cannot change the reseller name
        delete updateData['reseller_name'];
      }

      clientResource.clients.update({ resellerName : client.reseller, clientName : client.name }, updateData, function(data){
        console.log('Client updated sucessfully.');
        $state.reload()
        $mdDialog.hide();

      }, function(data){
        $scope.currentClient.$resolved = false;
        console.log('Error updating client. See response below...');
        console.log(data);
        mdToast.show(mdToast.getSimple(data.status + ' - Erro ao atualizar cliente.', 4000));
      });
    }

    function createFilterFor(query) {
      var lowercaseQuery = angular.lowercase(query);
      return function filterFn(reseller) {
        return (reseller.value.indexOf(lowercaseQuery) === 0);
      };
    }
  }

  app.controller("clientDialogCtrl", clientDialogCtrl);
  app.controller("clientCtrl", clientCtrl);
  
}());