(function () {

    angular
        .module('app')
        .controller('TeacherStudentsController', TeacherStudentsController);

    TeacherStudentsController.$inject = [
        'authService',
        'usersService',
        '$scope', '$mdDialog', '$document', '$timeout', 'loggerService'
    ];

    function TeacherStudentsController(authService, usersService, $scope, $mdDialog, $document, $timeout, loggerService) {

        var vm = this;
        vm.authService = authService;

        vm.allStudentPasswordsReset = false;

        var placeholderId = 1;

        $scope.MAX_PER_GROUP = 40;

        vm.groupedStudents = {};

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            var newId = alertId++;
            vm[type].push({
                alertid : newId,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
            return newId;
        }

        function noop() {}
        function assumeok() { return true; }
        function handleerr(err) {
            var errId = displayAlert('errors', err.status, err.data);
            scrollToNewItem('errors' + errId);
        }



        $scope.busy = true;
        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                if (profile.role === 'supervisor') {
                    if (!profile.groups) {
                        profile.groups = [];
                    }

                    usersService.getClassPolicy(profile)
                        .then(function (policy) {
                            vm.policy = policy;
                            $scope.busy = false;
                        })
                        .catch(handleerr);
                }
            })
            .catch(handleerr);





        // ---------------------------------------------------------------
        // Generic wrapper for most of the page logic, to make sure the
        //   global busy indicator is always set correctly
        // ---------------------------------------------------------------

        function performPageOperation(opname, prechecks, opfunction, onsuccess, onfail, confirmation) {
            loggerService.debug('[ml4kuser] starting ' + opname);

            $scope.busy = true;

            if (!prechecks()) {
                $scope.busy = false;
                return;
            }

            var runOp = function () {
                opfunction()
                    .then(onsuccess)
                    .then(function () {
                        loggerService.debug('[ml4kuser] completed ' + opname);

                        $scope.busy = false;
                    })
                    .catch(function (err) {
                        loggerService.error('[ml4kuser] failed to perform operation', opname, err);

                        onfail(err);

                        var errId = displayAlert('errors', err.status, err.data);
                        scrollToNewItem('errors' + errId);

                        $scope.busy = false;
                    });
            };

            if (confirmation) {
                requestConfirmationBeforeFunction(confirmation, runOp, function () {
                    $scope.busy = false;
                });
            }
            else {
                runOp();
            }
        }

        // ---------------------------------------------------------------
        // ----- DATA/API FUNCTIONS --------------------------------------
        // ---------------------------------------------------------------


        // Retrieving list of students to display in the page
        function fetchAndDisplayStudents(profile, groupname) {
            var operation = 'fetching students in group ' + groupname;
            var opFunction = function () {
                return usersService.getStudentList(profile, groupname);
            };
            var onSuccess = function (students) {
                vm.groupedStudents[groupname] = students;
            };
            performPageOperation(operation, assumeok, opFunction, onSuccess, noop);
        }


        // Retrieving the ungrouped students to display in the final list
        $scope.fetchAndDisplayUngroupedStudents = function () {
            var operation = 'fetching ungrouped students';

            var prechecks = function () {
                $scope.ungroupedStudentsExpanded = !$scope.ungroupedStudentsExpanded;
                return !vm.ungroupedStudents;
            };

            var opFunction = function () {
                return usersService.getStudentList(vm.profile, '');
            };

            var onSuccess = function (students) {
                vm.ungroupedStudents = students;
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, noop);
        };


        // Moving selected students from one group to another
        $scope.moveStudentsIntoGroup = function(fromgroup, togroup) {
            var operation = 'moving students from ' + fromgroup + ' to ' + togroup;

            var prechecks = function () {
                if (!selections[fromgroup]) {
                    selections[fromgroup] = [];
                }
                return true;
            };

            var movingStudents = getAndMarkSelectedStudents(fromgroup);

            var opFunction = function () {
                return usersService.addStudentsToGroup(selections[fromgroup], vm.profile.tenant, togroup);
            };

            var onSuccess = function () {
                if (vm.groupedStudents[togroup]) {
                    for (var i = 0; i < movingStudents.length; i++) {
                        var movingStudent = movingStudents[i];
                        movingStudent.isPlaceholder = false;
                        vm.groupedStudents[togroup].push(movingStudent);
                    }
                }
                if (fromgroup === 'ungrouped') {
                    vm.ungroupedStudents = vm.ungroupedStudents.filter(function (student) {
                        return selections[fromgroup].indexOf(student.id) === -1;
                    });
                }
                else {
                    vm.groupedStudents[fromgroup] = vm.groupedStudents[fromgroup].filter(function (student) {
                        return selections[fromgroup].indexOf(student.id) === -1;
                    });
                }
                selections[fromgroup] = [];
            };

            var onFailure = function () {
                for (var i = 0; i < movingStudents.length; i++) {
                    var movingStudent = movingStudents[i];
                    movingStudent.isPlaceholder = false;
                }
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, onFailure);
        };


        // Moving selected students from a group into the ungrouped list
        $scope.removeStudentsFromGroup = function(group) {
            var operation = 'removing students from group ' + group;

            var prechecks = function () {
                if (!selections[group]) {
                    selections[group] = [];
                }
                return true;
            };

            var movingStudents = getAndMarkSelectedStudents(group);

            var opFunction = function () {
                return usersService.removeStudentsFromGroup(selections[group], vm.profile.tenant);
            };

            var onSuccess = function () {
                if (vm.ungroupedStudents) {
                    for (var i = 0; i < movingStudents.length; i++) {
                        var movingStudent = movingStudents[i];
                        movingStudent.isPlaceholder = false;
                        vm.ungroupedStudents.push(movingStudent);
                    }
                }
                vm.groupedStudents[group] = vm.groupedStudents[group].filter(function (student) {
                    return selections[group].indexOf(student.id) === -1;
                });
                selections[group] = [];
            };

            var onFailure = function () {
                for (var i = 0; i < movingStudents.length; i++) {
                    var movingStudent = movingStudents[i];
                    movingStudent.isPlaceholder = false;
                }
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, onFailure);
        };


        // Delete selected students (display prompt first)
        vm.deleteUsers = function (ev, groupname) {
            var operation = 'deleting selected students from ' + groupname;

            var prechecks = function () {
                if (!vm.groupedStudents[groupname] || !selections[groupname]) {
                    return false;
                }
                return selections[groupname].length > 0 &&
                       selections[groupname].length <= $scope.MAX_PER_GROUP;
            };

            var studentsToDelete = getAndMarkSelectedStudents(groupname);

            var opFunction = function () {
                return usersService.deleteStudents(studentsToDelete, vm.profile.tenant);
            };

            var onSuccess = function (confirmation) {
                var deletedUserIds = confirmation.deleted.map(function (c) {
                    return c.id;
                });

                vm.groupedStudents[groupname] = vm.groupedStudents[groupname].filter(function (student) {
                    if (deletedUserIds.indexOf(student.id) > -1) {
                        // student was deleted
                        return false;
                    }
                    else {
                        // student could not be deleted
                        student.isPlaceholder = false;
                        return true;
                    }
                });
                selections[groupname] = [];

                if (studentsToDelete.length !== deletedUserIds.length) {
                    var errId = displayAlert('warnings', 400, { message : 'Not all selected students could be deleted' });
                    scrollToNewItem('warnings' + errId);
                }
            };

            var onFailure = function () {
                studentsToDelete.forEach(function (student) {
                    student.isPlaceholder = false;
                });
            };

            var confirmation = {
                message : 'Do you want to delete these students and all of their work? (This cannot be undone)',
                event : ev
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, onFailure, confirmation);
        };


        // Delete single student (display prompt first)
        vm.deleteUser = function (ev, groupname, student) {
            var operation = 'deleting student ' + student.username + ' ' + student.id;

            var prechecks = function () {
                student.isPlaceholder = true;
                return true;
            };

            var opFunction = function () {
                return usersService.deleteStudent(student, vm.profile.tenant);
            };

            var onSuccess = function () {
                if (groupname === 'ungrouped') {
                    vm.ungroupedStudents = vm.ungroupedStudents.filter(function (itm) {
                        return itm.username !== student.username;
                    });
                }
                else if (vm.groupedStudents[groupname]) {
                    vm.groupedStudents[groupname] = vm.groupedStudents[groupname].filter(function (itm) {
                        return itm.username !== student.username;
                    });
                }
            };

            var onFailure = function () {
                student.isPlaceholder = false;
            };

            var confirmation = {
                message : 'Do you want to delete ' + student.username + ' and all of their work? (This cannot be undone)',
                event : ev
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, onFailure, confirmation);
        };


        // Creating a new group of students
        $scope.createStudentGroup = function (ev) {
            loggerService.debug('[ml4kuser] requesting details for creating student group');

            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function () {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function (resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components/teacher_students/newgroup.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(groupname) {
                    var operation = 'creating student group ' + groupname;

                    var prechecks = function () {
                        return groupname &&
                               groupname !== 'ALL' &&
                               groupname !== 'ungrouped' &&
                               vm.profile.groups.indexOf(groupname) === -1;
                    };

                    var opFunction = function () {
                        return usersService.createClassGroup(vm.profile, groupname);
                    };

                    var onSuccess = function () {
                        vm.profile.groups.push(groupname);
                        authService.storeProfile(vm.profile);
                    };

                    performPageOperation(operation, prechecks, opFunction, onSuccess, noop);

                }, noop);
        };


        // Deleting a group of students (must be empty)
        $scope.deleteStudentGroup = function (ev, groupname) {
            var operation = 'deleting student group ' + groupname;

            var prechecks = function () {
                return vm.groupedStudents[groupname] &&
                       vm.groupedStudents[groupname].length === 0;
            };

            var opFunction = function () {
                return usersService.deleteClassGroup(vm.profile, groupname);
            };

            var onSuccess = function () {
                vm.profile.groups = vm.profile.groups.filter(function (g) {
                    return g !== groupname;
                });
                authService.storeProfile(vm.profile);
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, noop);
        };


        // reset password for single student
        vm.resetUserPassword = function (ev, student) {
            var operation = 'resetting student password ' + student.id + ' ' + student.username;

            var prechecks = function () {
                student.isPlaceholder = true;
                return true;
            };

            var opFunction = function () {
                return usersService.resetStudentPassword(student, vm.profile.tenant);
            };

            var onSuccess = function (updatedUser) {
                student.isPlaceholder = false;
                displayPassword(ev, updatedUser);
            };

            var onFailure = function () {
                student.isPlaceholder = false;
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, onFailure);
        };


        // Resetting multiple student passwords
        vm.resetUsersPassword = function (ev, groupname) {
            var operation = 'resetting passwords for selected students in ' + groupname;

            var prechecks = function () {
                return vm.groupedStudents[groupname] && selections[groupname] && selections[groupname].length > 0;
            };

            vm.allStudentPasswordsReset = true;
            var studentsToReset = getAndMarkSelectedStudents(groupname);

            var opFunction = function () {
                return usersService.resetStudentsPassword(studentsToReset, vm.profile.tenant);
            };

            var onSuccess = function (resp) {
                studentsToReset.forEach(function (student) {
                    student.isPlaceholder = false;
                });
                displayPassword(ev, {
                    username : 'Selected students',
                    password : resp.password
                }, studentsToReset.length > 30);
            };

            var onFailure = function () {
                studentsToReset.forEach(function (student) {
                    student.isPlaceholder = false;
                });
                vm.allStudentPasswordsReset = false;
            };

            var confirmation = {
                message : 'Do you want to reset the passwords for the selected students (so they all have the same password)?',
                event : ev
            };

            performPageOperation(operation, prechecks, opFunction, onSuccess, onFailure, confirmation);
        };


        // Creating single user
        vm.createUser = function (ev, group) {
            loggerService.debug('[ml4kuser] requesting details for creating individual student in group ' + group);

            if (!vm.groupedStudents[group] || vm.groupedStudents[group].length >= $scope.MAX_PER_GROUP) {
                return;
            }

            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function () {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function (resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components/teacher_students/newstudent.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(username) {
                    var operation = 'creating student ' + username;

                    var newUserObj = {
                        id : placeholderId++,
                        username : username,
                        group : group,
                        isPlaceholder : true
                    };
                    vm.groupedStudents[group].push(newUserObj);

                    var opFunction = function () {
                        return usersService.createStudent(newUserObj, vm.profile.tenant);
                    };

                    var onSuccess = function (newUser) {
                        newUserObj.id = newUser.id;
                        newUserObj.isPlaceholder = false;

                        displayPassword(ev, newUser);
                    };

                    var onFailure = function () {
                        vm.groupedStudents[group] = vm.groupedStudents[group].filter(function (student) {
                            return student.id !== newUserObj.id;
                        });
                    };

                    performPageOperation(operation, assumeok, opFunction, onSuccess, onFailure);

                }, noop);
        };


        // Creating multiple users
        vm.createMultipleUsers = function (ev, group) {
            loggerService.debug('[ml4kuser] requesting details for creating multiple students');

            var userslimit = Math.min($scope.MAX_PER_GROUP, vm.policy.maxUsers);
            var remaining = userslimit - vm.groupedStudents[group].length;

            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.remaining = remaining;
                    $scope.userslimit = userslimit;

                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function () {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function (prefix, number, password) {
                        $mdDialog.hide({
                            prefix : prefix,
                            number : number,
                            password : password
                        });
                    };
                    $scope.refreshPassword = function () {
                        $scope.password = '...';
                        usersService.getGeneratedPassword(vm.profile.tenant)
                            .then(function (resp) {
                                $scope.password = resp.password;
                            })
                            .catch(function (err) {
                                loggerService.error('[ml4kuser] failed to generate password', err);
                            });
                    };

                    $scope.refreshPassword();
                },
                templateUrl : 'static/components/teacher_students/newstudents.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function(dialogResp) {
                    var operation = 'creating multiple students';

                    var prechecks = function () {
                        if (vm.groupedStudents[group] && dialogResp.number && dialogResp.number < $scope.MAX_PER_GROUP) {
                            for (var i = 1; i <= dialogResp.number; i++) {
                                var newUserObj = {
                                    id : placeholderId++,
                                    username : dialogResp.prefix + i,
                                    isPlaceholder : true,
                                    group : group
                                };
                                vm.groupedStudents[group].push(newUserObj);
                            }
                            return true;
                        }
                        else {
                            return false;
                        }
                    };

                    var opFunction = function () {
                        return usersService.createStudents(vm.profile.tenant, dialogResp.prefix, dialogResp.number, dialogResp.password, group);
                    };

                    var onSuccess = function (apiResp) {
                        vm.groupedStudents[group] = vm.groupedStudents[group].filter(function (student) {
                            return !student.isPlaceholder;
                        });

                        if (apiResp && apiResp.successes) {
                            for (var i = 0; i < apiResp.successes.length; i++) {
                                vm.groupedStudents[group].push(apiResp.successes[i]);
                            }
                        }

                        displayCreateFailures(ev, apiResp, dialogResp.password);
                    };

                    var onFailure = function () {
                        vm.groupedStudents[group] = vm.groupedStudents[group].filter(function (student) {
                            return !student.isPlaceholder;
                        });
                    };

                    performPageOperation(operation, prechecks, opFunction, onSuccess, onFailure);

                }, noop);
        };



        // ---------------------------------------------------------------
        // ----- PAGE INTERACTIVITY FUNCTIONS ----------------------------
        // ---------------------------------------------------------------


        // ---------------------------------------------------------------
        // Handling the collapsable lists of students
        // ---------------------------------------------------------------

        var expandedpanels = [];
        $scope.collapsePanel = function (group) {
            var idx = expandedpanels.indexOf(group);
            if (idx > -1) {
                expandedpanels.splice(idx, 1);
            }
            else {
                expandedpanels.push(group);

                if (!vm.groupedStudents[group]) {
                    fetchAndDisplayStudents(vm.profile, group);
                }
            }
        };
        $scope.isPanelCollapsed = function (group) {
            return expandedpanels.indexOf(group) > -1;
        };

        $scope.ungroupedStudentsExpanded = false;

        // ---------------------------------------------------------------
        // Handling the selection checkboxes
        // ---------------------------------------------------------------

        var selections = {};
        $scope.updateStudentSelection = function (group, studentid) {
            if (!selections[group]) {
                selections[group] = [];
            }
            var idx = selections[group].indexOf(studentid);
            if (idx > -1) {
                selections[group].splice(idx, 1);
            }
            else if (selections[group].length < $scope.MAX_PER_GROUP) {
                selections[group].push(studentid);
            }
        };
        $scope.selectAllStudents = function (group) {
            if ($scope.areAllStudentsSelected(group)) {
                selections[group] = [];
            }
            else {
                if (group === 'ungrouped') {
                    selections[group] = vm.ungroupedStudents.map(function (student) {
                        return student.id;
                    });
                }
                else {
                    selections[group] = vm.groupedStudents[group].map(function (student) {
                        return student.id;
                    });
                }
            }
        };
        $scope.isStudentSelected = function (group, studentid) {
            if (!selections[group]) {
                selections[group] = [];
            }
            return selections[group].indexOf(studentid) > -1;
        };
        $scope.areStudentsSelected = function (group) {
            return selections[group] && selections[group].length > 0;
        };
        $scope.areAllStudentsSelected = function (group) {
            if (group === 'ungrouped') {
                return selections[group] &&
                       vm.ungroupedStudents &&
                       selections[group].length === vm.ungroupedStudents.length;
            }
            else {
                return selections[group] &&
                       vm.groupedStudents[group] &&
                       selections[group].length === vm.groupedStudents[group].length;
            }
        };

        function getAndMarkSelectedStudents(groupname) {
            var selectedStudentObjs = [];
            if (groupname === 'ungrouped') {
                selectedStudentObjs = vm.ungroupedStudents.filter(function (student) {
                    var shouldMove = $scope.isStudentSelected(groupname, student.id);
                    if (shouldMove) {
                        student.isPlaceholder = true;
                    }
                    return shouldMove;
                });
            }
            else {
                selectedStudentObjs = vm.groupedStudents[groupname].filter(function (student) {
                    var shouldMove = $scope.isStudentSelected(groupname, student.id);
                    if (shouldMove) {
                        student.isPlaceholder = true;
                    }
                    return shouldMove;
                });
            }
            return selectedStudentObjs;
        }

        // ---------------------------------------------------------------
        // Requesting user confirmation
        // ---------------------------------------------------------------

        // Display confirmation dialog before running function
        function requestConfirmationBeforeFunction (confirmationReq, ifConfirmed, ifCancelled) {
            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent(confirmationReq.message)
                .ariaLabel('Confirm')
                .targetEvent(confirmationReq.event)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(ifConfirmed, ifCancelled);
        }

        // Displaying a generated password
        function displayPassword(ev, student, showWarning) {
            $mdDialog.show(
                $mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title(student.username)
                    .htmlContent(
                        '<div>Password: <span class="passworddisplaydialog">' + student.password + '</span></div>' +
                        (showWarning ? '<div><strong>Note:</strong> This may take a few minutes to take effect. Please be patient.' : ''))
                    .ariaLabel('Confirm student password')
                    .ok('OK')
                    .targetEvent(ev)
                );
        }


        function displayCreateFailures (ev, resp, password) {
            if (resp && resp.successes && resp.failures && resp.duplicates) {

                if (resp.failures.length > 0 || resp.duplicates.length > 0)
                {
                    var title = resp.failures.length > 0 ?
                                    'Something went wrong!' :
                                    'Usernames already in use';

                    var message = '';

                    if (resp.failures.length > 0) {
                        message = '<div>Sorry. An unexpected error happened when trying to create: <br/>' +
                                    '<code>' + resp.failures.join(', ') + '</code>' +
                                '</div>';
                    }
                    if (resp.duplicates.length > 0) {
                        message = '<div>The following student accounts could not be created because there are ' +
                                    'already users with these usernames: <br/>' +
                                    '<code>' + resp.duplicates.join(', ') + '</code>' +
                                '</div>';
                    }

                    displayCreateErrorMessage(ev, title, '<div style="padding: 1em">' + message + '</div>');
                }
                else if (resp.successes.length > 0) {
                    displayPassword(ev, {
                        username : 'New students created:',
                        password : password
                    }, false);
                }
            }
            else {
                var errId = displayAlert('errors', 500, { error : 'Unexpected response' });
                scrollToNewItem('errors' + errId);
            }
        }

        function displayCreateErrorMessage(ev, title, contents) {
            $mdDialog.show(
                $mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title(title)
                    .htmlContent(contents)
                    .ok('OK')
                    .targetEvent(ev)
                );
        }

        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
    }
}());
