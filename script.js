var FileRenamer = {
	_actions: [],
	_files: [],
	_fileSelectedCount: 0,
	_fileAddedCount: 0,
    _keepFileSelectOrder: false,
    _currentlyImportingActions: false,
    _filesOriginalOrder: [],
	_ignoreExtensions: true,
    _filterByError: false,
    _cancelRenaming: false,
    _targetCount: 0,
    _currentCount: 0,

    onPageLoad: function() {
        // this.addFileInputListener();

        var list = document.getElementById('action-list');
        Sortable.create(list, {onSort: function(evt){
            FileRenamer.onActionReorder();
        }, handle:'.drag-handle' });
    },
    onFileSelected: function() {
        var elem = document.getElementById('upload-file-input'); 
    	
    	this._fileSelectedCount = this._fileSelectedCount + elem.files.length;	

        for (var file of elem.files) {
            FileRenamer._addFile(file);
        }
    },
    _addFile: function(file) {
        for (i = 0; i < this._files.length; i++) {
            if (file.name == this._files[i].name) {
            	this._fileAddedCount++;
                return;
            }
        }
        // Still here? Then a file with this name is not yet in the Array
        var lower = file.name.toLowerCase();
        if (lower.endsWith('.jpg') ||
            lower.endsWith('jpeg') ||
            lower.endsWith('tiff') ) {
            EXIF.getData(file, function() {
                FileRenamer._files.push(this);
                FileRenamer._filesOriginalOrder.push(this);
                FileRenamer._sortFiles();
                FileRenamer._fileAddedCount++;
                FileRenamer.onAnyInput();   
            });
        } else {
            FileRenamer._files.push(file);
            FileRenamer._filesOriginalOrder.push(file);
            FileRenamer._sortFiles();
            FileRenamer._fileAddedCount++;
            FileRenamer.onAnyInput();            
        }
    },
    _sortFiles: function() {
    	if (this._keepFileSelectOrder == true) {
            this._files = this._filesOriginalOrder.slice();
            return;
        }

        var columns = ['name'];
        
        var naturalSort = function(a, b, columnname) {
            var NUMBER_GROUPS = /(-?\d*\.?\d+)/g;
            var a_field1 = a[columnname],
                b_field1 = b[columnname],
                aa = String(a_field1).split(NUMBER_GROUPS),
                bb = String(b_field1).split(NUMBER_GROUPS),
                min = Math.min(aa.length, bb.length);
            for (var i = 0; i < min; i++) {
                var x = parseFloat(aa[i]) || aa[i].toLowerCase(),
                    y = parseFloat(bb[i]) || bb[i].toLowerCase();
                if (x < 0) {
                	x = x * -1;
                }
                if (y < 0) {
                	y = y * -1;
                }		    
                if (x < y) return -1;
                else if (x > y) return 1;
            }
            return 0;
        };

        this._files.sort(function(a, b) {
            var result;
            for (var i = 0; i < columns.length; i++) {
                result = naturalSort(a, b, columns[i]);
                if (result !== 0) return result; // or -result for decending
            }
            return 0; //If both are exactly the same
        });        
    },
    onToggleFileSort: function() {
        this._keepFileSelectOrder = document.getElementById('chk-sorting').checked;
        this._sortFiles();
        this.onAnyInput();
    },
    onSelectFiles: function() {
    	document.getElementById('upload-file-input').click();
    },
    updateRenamingProgress: function() {
        var progress = document.getElementById('renaming-progress');
        if (this._targetCount > 0 && this._currentCount > 0) {
            progress.value = String(Number(this._currentCount / this._targetCount) * 100);
        } else {
            progress.value = 0;
        }

        // Update the overlays title
        var title = document.getElementById('renaming-overlay-title');
        title.innerText = 'Renaming File ' + this._currentCount + ' of ' + this._targetCount;

		// Only show the overlay if there is more than 1 file to be renamed...
        var overlay = document.getElementById('renaming-overlay');
        if (this._targetCount > 1 && this._currentCount < this._targetCount) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    },
    onRenameFiles: async function() {
        this._cancelRenaming = false;
        this._targetCount = this._files.length;
        this._currentCount = 0;
        this.updateRenamingProgress();

    	for (var file of this._files) {
    		var fileReader = new FileReader();
    		fileReader.onload = function(e) {
    			//console.log(e);
    			//console.log(e.target);
                if (FileRenamer._cancelRenaming == true) {
                    FileRenamer._currentCount = FileRenamer._targetCount = 0;
                    FileRenamer.updateRenamingProgress();
                    return;
                }

    			var arrayBuffer = e.target.result; //this.result
    			FileRenamer._saveFile(e.target.zFileName, arrayBuffer, e.target.zMimeType);

                FileRenamer._currentCount++;
                FileRenamer.updateRenamingProgress();
    		};
    		fileReader.zFileName = file.zNewFileName;
    		fileReader.zMimeType = file.type;
    		fileReader.readAsArrayBuffer(file);
			// Some browsers limit auto-download. So we wait between downloads
			await new Promise(r => setTimeout(r, 3000));
    	}

    	//this.onAnyInput(); 	
    },
    onClearFiles: function() {
    	this._files = [];
		this._filesOriginalOrder = [];
    	this._fileSelectedCount = 0;
    	this._fileAddedCount = 0;

    	this.onAnyInput();
    },
    keepPreviewCurrent: function() {
        // Disable the Main Buttons, to prevent in-between renaming
        this.disableButton('btn-rename');
        this.disableButton('btn-clear-files');        

    	var container = document.getElementById('preview-table-body');

    	// If we have actions, allow downloads
    	var downloadActionsButton = document.getElementById('download-actions');
    	if (this._actions.length > 0) {
    		downloadActionsButton.classList.remove('disabled');
    	} else {
			downloadActionsButton.classList.add('disabled');
    	}

    	// Retrieve Values from HTML Input Fields into Action Objects
    	for (var action of this._actions) {
    		action.getHTMLValues();
            // And rename a dummy file (because action input validation lives in the renaming function)
            var parts = [
                new Blob(['you construct a file...'], {type: 'text/plain'}),
                          'Same way as you do with blob',
                new Uint16Array([33])
            ];
            var f = new File(parts, 'sample.txt', {
                lastModified: new Date(0), 
                type: "text/plain" // optional - default = ''
            });

            this.calculateNewNameForFile(f);
    	}
        for (var action of this._actions) {
            // Cleanup the Actions in a separate loop directly, 
            // becase calculateNewNameForFile in the loop above could alter them internally
            action.resetInternalState();
        }

    	// Clear Old List
    	var newHTML = '';

    	// Calculate new Filenames
    	for (var file of this._files) {
    		var filename_new = this.calculateNewNameForFile(file);

            file.zNewFileName = filename_new;
        }
        // Validate new Filenames
        this.validateNewFileNames();

        // Did Validation find anything?
        var errorCount = 0;
        for (var file of this._files) {
            if (file.zNewFileNameIsValid == false) {
                errorCount++;
            }
        } 

        // Display Validation Information
        var toast = document.getElementById('validation-toast');

		// If we are still adding files: display file count
		if (this._fileSelectedCount > 0 && this._fileAddedCount != this._fileSelectedCount) {
			toast.classList.add('toast-success');
            toast.classList.remove('toast-error');
            toast.innerText = 'Added File ' + this._fileAddedCount + ' of ' + this._fileSelectedCount;
            toast.style.display = 'initial';
		} else {
			if (errorCount > 0) {
				toast.classList.remove('toast-success');
				toast.classList.add('toast-error');
				toast.innerText = 'Validation failed';
				toast.innerText += ' (' + errorCount + '/' + this._files.length + ')';
				this.disableButton('btn-rename');
				toast.style.display = 'initial';
				newHTML = toast.innerText;
				if (this._filterByError == true) {
					newHTML += ' ⚑';
				} else {
					newHTML += ' ⚐';
				}
				toast.innerHTML = newHTML;
			} else {
				this._filterByError = false;
				if (this._files.length > 0) {
					toast.classList.add('toast-success');
					toast.classList.remove('toast-error');
					toast.innerText = 'Validation OK';
					toast.innerText += ' (' + this._files.length + ')';
					this.enableButton('btn-rename');
					toast.style.display = 'initial';
				} else {
					toast.classList.remove('toast-success');
					toast.classList.remove('toast-error');
					toast.style.display = 'none';
				}
			}
		}

        // List new Filenames
        newHTML = '';
        for (var file of this._files) {
    		// Replace Spaces with HTML Char
    		var filename_new = file.zNewFileName.replace(/ /g, '&nbsp;'); 

            if (this._filterByError == true && file.zNewFileNameIsValid == true) {
                continue;
            }

    		newHTML += '<tr><td><mono>' + file.name + '</mono></td>';
            var extraClass = '';
            if (file.zNewFileNameIsValid == false) {
                extraClass = 'is-error tooltip';
            }
            newHTML += '<td><mono class="' + extraClass + '" data-tooltip="' + file.zNewFileInvalidReason + '">';
            newHTML += filename_new + '</mono></td></tr>';
    	}
    	container.innerHTML = newHTML;

        // Re-Enable Buttons if needed
        if (this._files.length > 0) {
            this.enableButton('btn-rename');
            this.enableButton('btn-clear-files');
        }       
    },
    calculateNewNameForFile: function(file) {
    	var filename_new = file.name
    	var extension = '';

    	if (this._ignoreExtensions) {
    		extension = filename_new.split('.').pop();
    		filename_new = this.removeExtension(filename_new);
    	}

    	for (var action of this._actions) {
    		filename_new = action.renameFile(file, filename_new, extension);

			if (extension != '' && action.constructor.name != 'renamingActionExtensionToLowerCase') {
    			filename_new = filename_new + '.' + extension;
    		}
    	}

    	// Special Consideration: Trim Trailing Whitespaces. ALWAYS
    	filename_new = filename_new.trimRight();

    	return filename_new;
    },
    validateNewFileNames: function() {
        for (var i = 0; i < this._files.length; i++) {
            var file = this._files[i];
            file.zNewFileNameIsValid = true;

            // Filename empty?
            if (file.zNewFileName.trim() == '' || this.removeExtension(file.zNewFileName).trim() == '') {
                file.zNewFileNameIsValid = false;
                file.zNewFileInvalidReason = 'Empty Filename';
            }

            if (file.zNewFileNameIsValid == false) {
                continue;
            }

            // Detect Naming Collisions
            for (var j = 0; j < this._files.length; j++) {
                if (file.zNewFileName == this._files[j].zNewFileName && i != j) {
                    file.zNewFileNameIsValid = false;
                    file.zNewFileInvalidReason = 'Duplicate Filename';
                }
            }
        }
    },
	removeExtension: function(filename){
	    var lastDotPosition = filename.lastIndexOf('.');
	    if (lastDotPosition === -1) {
	    	return filename;
	    } else {
	    	return filename.substr(0, lastDotPosition);
	    }
	},
    _saveFile: function(filename, data, mimeType) {
	    var blob = new Blob([data], {type: mimeType});
	    if(window.navigator.msSaveOrOpenBlob) {
	        window.navigator.msSaveBlob(blob, filename);
	    } else {
	        var elem = window.document.createElement('a');
	        elem.href = window.URL.createObjectURL(blob);
	        var url = elem.href;
	        elem.download = filename;        
	        document.body.appendChild(elem);
	        elem.click();        
	        document.body.removeChild(elem);
	        window.URL.revokeObjectURL(url);
	    }
    },
    getActionInstance: function(actionName) {
    	// This method is used in Calls from UI
    	// as well as JSON upload
    	var newAction = new Object;
		switch (actionName) {
			case 'renamingActionAddString':
		  	case 'stringAdd':
		  		newAction = new renamingActionAddString();
		    	break;
		    case 'renamingActionReplaceString':
		  	case 'stringReplace':
		  		newAction = new renamingActionReplaceString();
                break;
            case 'renamingActionReplaceRegexString':
            case 'stringRegexReplace':
                newAction = new renamingActionReplaceRegexString();
                break;    
            case 'renamingActionDeleteLeadingString':        
            case 'stringDeleteLeading':
                newAction = new renamingActionDeleteLeadingString();
		  		break;
		  	case 'renamingActionDeleteTrailingString':
            case 'stringDeleteTrailing':
                newAction = new renamingActionDeleteTrailingString();
                break;      
            case 'renamingActionChangeCase': 
            case 'stringChangeCase':
                newAction = new renamingActionChangeCase();
                break;     
            case 'renamingActionAddDate':
            case 'addDate':
                newAction = new renamingActionAddDate();
                break;
            case 'renamingActionAddSequence':
            case 'addSequence':
                newAction = new renamingActionAddSequence();
                break;
            case 'renamingActionRemoveSpaces':
            case 'removeSpaces':
            	newAction = new renamingActionRemoveSpaces();
            	break; 
            case 'renamingActionExtensionToLowerCase':
            case 'lowercaseExtension':
            	newAction = new renamingActionExtensionToLowerCase();
            	break;                                              
		  	default:
		  		throw('Unknown Action!');
		}    	
		return newAction;
    },
    onAddAction: function(actionName) {
		var newAction = this.getActionInstance(actionName);
		this._actions.push(newAction);

		this.onAnyInput();
    },
    onRemoveAction: function(removeUUID) {
        this.disableButton('btn-rename');
        var newActions = new Array;
        for (var action of this._actions) {
            if (action._UUID != removeUUID) {
                newActions.push(action);
            } else {
                var id = action.getLiId();
                var elem = document.getElementById(id);
                elem.parentNode.removeChild(elem);
            }
        }

        this._actions = newActions;

    	this.onAnyInput();
        this.enableButton('btn-rename');
    },
    onValidationFilterToggle: function() {
        if (this._filterByError == true) {
            this._filterByError = false;
        } else {
            this._filterByError = true;
        }

        this.onAnyInput();
    },
    onActionReorder: function() {
        this.disableButton('btn-rename');
        var list = document.getElementById('action-list').children;
        var newActions = new Array;
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            for (var action of this._actions) {
                if (action.getLiId() == item.id) {
                    newActions.push(action);
                }
            }
        }

        this._actions = newActions;

        this.onAnyInput();
        this.enableButton('btn-rename')
    },
    onDownloadActions: function() {
    	if (this._actions.length == 0) {
    		return;
    	}
    	var down = [];
    	for (i = 0; i < this._actions.length; i++) {
    		var action = this._actions[i];
			var downAction = {};
			downAction['className'] = action.constructor.name;
			downAction['instance'] = action;
			down.push(downAction);
    	}
    	var actionJSON = JSON.stringify(down);
    	var today = new Date();
		var filename = 'WebFileRenamerActions ' + today.toUTCString() + '.json';
    	this._saveFile(filename, actionJSON, 'application/json');
    },
    onUploadActions: function() {
		document.getElementById('upload-actions-input').click();
    },
    onUploadActionsFile: function() {
    	var elem = document.getElementById('upload-actions-input'); 
    	if (elem.files.length == 0) {
    		return;
    	}
    	var file = elem.files[0];
		var fileReader = new FileReader();
		fileReader.onload = function(e) {
			var text = e.target.result;
			var down = JSON.parse(text);
			if (down.length == 0) {
				return;
			}
			
			FileRenamer.disableButton('btn-rename');
			FileRenamer._actions = [];
			var list = document.getElementById('action-list');
			while (list.firstChild) {
    			list.removeChild(list.firstChild);
			}
			FileRenamer._currentlyImportingActions = true;
			for (i = 0; i < down.length; i++) {
				var downAction = down[i];
				var className = downAction['className'];
				var instance  = downAction['instance'];
				
				UUIDGenerator._uuids.push(instance['_UUID']); // Should be unnecessary ...

				var newAction = FileRenamer.getActionInstance(className);
				for (var property in instance) {
					if (newAction.hasOwnProperty(property)) {
						newAction[property] = instance[property];
					}
				}
				FileRenamer._actions.push(newAction);
			}

			FileRenamer._currentlyImportingActions = false;
			for (i = 0; i < FileRenamer._actions.length; i++) {
				FileRenamer._actions[i].buildHTML();
				FileRenamer._actions[i].setHTMLValues();
			}
			document.getElementById('upload-actions-input').value = '';
			FileRenamer.enableButton('btn-rename');
			FileRenamer.onAnyInput();
		};
		fileReader.readAsText(file);
    },
    onRangeForInput: function(id) {
        var target = document.getElementById(id);
        target.value = window.event.target.value;

        this.onAnyInput();       
    },
    enableButton: function(id) {
        var button = document.getElementById(id);
        button.removeAttribute('disabled');
    },
    disableButton: function(id) {
        var button = document.getElementById(id);
        button.setAttribute('disabled', true);
    },
    onToggleIgnoreExtensions: function() {
    	this._ignoreExtensions = document.getElementById('chk-extensions').checked;

    	this.onAnyInput();
    },
    onAnyInput: function() {
		this.keepPreviewCurrent();
    },
    onCancelRenaming: function() {
        this._cancelRenaming = true;
        this._currentCount = this._targetCount = 0;
        this.updateRenamingProgress();
    },
}


String.prototype.reverse = function () {
    return this.split('').reverse().join('');
};

class renamingActionBase {
	constructor() {
    	this._UUID = UUIDGenerator.generate();
    	this._liID = 'li-' + this._UUID;
    	this._caID = 'ca-' + this._UUID;
  	}
  	buildHTML() {
  		var list = document.getElementById('action-list');
  		if (document.getElementById(this._liID) === null &&
  		    FileRenamer._currentlyImportingActions == false) {
  			var newCont = document.createElement('li');
  			newCont.id = this._liID;
  			
            var newHTML = '<div class="card"><div class="card-header">';
  			newHTML += '<h4 class="card-title">';
            newHTML += '<span class="drag-handle">☰&nbsp;&nbsp;' + this.getTitle() + '</span>';
            newHTML += '<button class="btn btn-clear float-right"';
            newHTML += ' onclick="FileRenamer.onRemoveAction(' + "'" + this._UUID + "'" + ');"></button>';
            newHTML += '</h4></div>';
            
            var cardBody = this.getHTMLBody();
            if (cardBody != '') {
                newHTML += '<div class="card-body">' + cardBody + '</div>';
            }
            newHTML += '</div>';
  			newCont.innerHTML = newHTML;
  			list.appendChild(newCont);
  		}
  	}
  	getTitle() {
  		throw('This method has to be redefined!');
  	}
  	getHTMLBody() {
  		throw('This method has to be redefined!');
  	}
  	getHTMLValues() {
  		throw('This method has to be redefined!');
  	}
  	setHTMLValues() {
  		throw('This method has to be redefined!');
  	}
  	resetInternalState() {
  		throw('This method has to be redefined!');
  	}
  	renameFile(file, filename_new) {
  		throw('This method has to be redefined!');
  	}
    getLiId() {
        return this._liID;
    }
}


class renamingActionAddString extends renamingActionBase {
	constructor() {
		super();
		this._addStringInputId = 'inp-' + this._UUID;
		this._addString = '';
        this._putWhereInputId = 'whr-' + this._UUID;
        this._putWhere = 'PREPEND';

		this.buildHTML();
	}
	getTitle() {
		return 'Add String';
	}
	getHTMLBody() {
		var newHTML = '';

        newHTML += '<label class="form-label" for="' + this._putWhereInputId + '">Option</label>'
        newHTML += '<select class="form-select" id="' + this._putWhereInputId + '" onchange="FileRenamer.onAnyInput();">';
        newHTML += '<option value="1">Prepend</option>';
        newHTML += '<option value="2">Append</option>';
        newHTML += '</select>';

		newHTML += '<input class="form-input" type="text" name="' + this._addStringInputId + '"';
		newHTML += ' id="' + this._addStringInputId + '" oninput="FileRenamer.onAnyInput();"></input>';
		return newHTML;
	}
	getHTMLValues() {
		this._addString = document.getElementById(this._addStringInputId).value;
        var e = document.getElementById(this._putWhereInputId);
        switch (e.options[e.selectedIndex].value) {
            case '2':
                this._putWhere = 'APPEND';
                break;          
            default:
                this._putWhere = 'PREPEND';
                break;
        }        
	}
	setHTMLValues() {
		document.getElementById(this._addStringInputId).value = this._addString;
        var e = document.getElementById(this._putWhereInputId);
        switch (this._putWhere) {
            case 'APPEND':
            	e.value = '2';
            	break;
            default:
				e.value = '1'
				break;
        }	
	}
	resetInternalState() {
		// Nothing to reset
	}
	renameFile(file, filename_new) {
        switch (this._putWhere) {
            case 'PREPEND':
                return this._addString + filename_new;
                break;
            case 'APPEND':
                return filename_new + this._addString;
                break;
        }
	}
}

class renamingActionReplaceString extends renamingActionBase {
	constructor() {
		super();
		this._replaceStringInputId = 'inp-' + this._UUID;
		this._replaceString = '';
        this._replaceWithInputId = 'rpw-' + this._UUID;
        this._replaceWith = '';
		this._caseSensitiveInputId = 'chk-' + this._UUID;
		this._caseSensitive = false;
        this._replaceTypeInputId = 'tbx-' + this._UUID;
		this._replaceType = 'EVERY'; //FIRST //LAST

		this.buildHTML();
	}
	getTitle() {
		return 'Replace String';
	}
	getHTMLBody() {
		var newHTML = '';
		newHTML += '<div class="form-group">'
        newHTML += '<label class="form-label" for="' + this._replaceStringInputId + '">Find</label>'
		newHTML += '<input class="form-input" type="text" name="' + this._replaceStringInputId + '"';
		newHTML += ' id="' + this._replaceStringInputId + '" oninput="FileRenamer.onAnyInput();"></input>';

        newHTML += '<label class="form-label" for="' + this._replaceWithInputId + '">Replace with</label>'
        newHTML += '<input class="form-input" type="text" name="' + this._replaceWithInputId + '"';
        newHTML += ' id="' + this._replaceWithInputId + '" oninput="FileRenamer.onAnyInput();"></input>';
		newHTML += '</div>';

		newHTML += '<div class="form-group">'
        newHTML += '<select class="form-select" id="' + this._replaceTypeInputId + '" onchange="FileRenamer.onAnyInput();">';
        newHTML += '<option value="1">Replace Every Occurence</option>';
        newHTML += '<option value="2">Replace First Occurence</option>';
        newHTML += '<option value="3">Replace Last Occurence</option>';
        newHTML += '</select>';

        newHTML += '<label class="form-switch case-switch"><input type="checkbox" onchange="FileRenamer.onAnyInput();"';
        newHTML += ' id="' + this._caseSensitiveInputId + '"/><i class="form-icon"></i>Case Sensitive</label>';
		newHTML += '</div>';

		return newHTML;
	}
	getHTMLValues() {
		this._replaceString = document.getElementById(this._replaceStringInputId).value;
        this._replaceWith   = document.getElementById(this._replaceWithInputId).value;
		this._caseSensitive = document.getElementById(this._caseSensitiveInputId).checked;
        var e = document.getElementById(this._replaceTypeInputId);
        switch (e.options[e.selectedIndex].value) {
            case '2':
                this._replaceType = 'FIRST';
                break;
            case '3':
                this._replaceType = 'LAST';
                break;
            default:
                this._replaceType = 'EVERY';
                break;
        }
	}
	setHTMLValues() {
		document.getElementById(this._replaceStringInputId).value   = this._replaceString;
		document.getElementById(this._replaceWithInputId).value     = this._replaceWith;
		document.getElementById(this._caseSensitiveInputId).checked = this._caseSensitive;
       	var e = document.getElementById(this._replaceTypeInputId);
        switch (this._replaceType) {	
			case 'FIRST':
				e.value = '2';
				break;
			case 'LAST':
				e.value = '3';
				break;		
			default:
				e.value = '1';
				break;	
        }	
	}
	resetInternalState() {
		// Nothing to reset
	}
	renameFile(file, filename_new) {
        var options = '';
        switch (this._replaceType) {
            case 'EVERY':
                options += 'g';
                break;
            case 'FIRST':
                break; // JS Standard
            case 'LAST':
                break; // See below
        }
        
        if (this._caseSensitive == false) {
            options += 'i'; 
        }

        var searchText = this._replaceString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        var rgExp = new RegExp(searchText, options);
        var replaceText = this._replaceWith;

        if (this._replaceType == 'LAST') {
            return filename_new.reverse().replace(new RegExp(searchText.reverse(), options), replaceText.reverse()).reverse();
        }

        return filename_new.replace(rgExp, replaceText);
	}
}


class renamingActionReplaceRegexString extends renamingActionBase {
    constructor() {
        super();
        this._replaceStringInputId = 'inp-' + this._UUID;
        this._replaceString = '';
        this._replaceWithInputId = 'rpw-' + this._UUID;
        this._replaceWith = '';
        this._optionsInputId = 'opt-' + this._UUID;
        this._optionsString = '';

        this.buildHTML();
    }
    getTitle() {
        return 'Replace RegEx String';
    }
    getHTMLBody() {
        var newHTML = '';
        newHTML += '<div class="form-group">'
        newHTML += '<table class="table-invisible"><tr><td>'
        newHTML += '<label class="form-label" for="' + this._replaceStringInputId + '">Find RegEx</label>'
        newHTML += '<input class="form-input" type="text" name="' + this._replaceStringInputId + '"';
        newHTML += ' placeholder="[^]"';
        newHTML += ' id="' + this._replaceStringInputId + '" oninput="FileRenamer.onAnyInput();"></input>';
        newHTML += '</td><td>';

        newHTML += '<label class="form-label" for="' + this._optionsInputId + '">Options</label>'
        newHTML += '<input class="form-input" type="text" name="' + this._optionsInputId + '" pattern="^[gimuy]+$"';
        newHTML += ' placeholder="gimuy"';
        newHTML += ' id="' + this._optionsInputId + '" oninput="FileRenamer.onAnyInput();"></input>';

        newHTML += '</td></tr></table>';
        newHTML += '<label class="form-label" for="' + this._replaceWithInputId + '">Replace with</label>'
        newHTML += '<input class="form-input" type="text" name="' + this._replaceWithInputId + '"';
        newHTML += ' id="' + this._replaceWithInputId + '" oninput="FileRenamer.onAnyInput();"></input>';
        newHTML += '</div>';

        return newHTML;
    }
    getHTMLValues() {
        this._replaceString = document.getElementById(this._replaceStringInputId).value;
        this._replaceWith   = document.getElementById(this._replaceWithInputId).value;
        this._optionsString = document.getElementById(this._optionsInputId).value;
    }
    setHTMLValues() {
        document.getElementById(this._replaceStringInputId).value = this._replaceString;
        document.getElementById(this._replaceWithInputId).value   = this._replaceWith;
        document.getElementById(this._optionsInputId).value       = this._optionsString;	
    }
    resetInternalState() {
        // Nothing to reset
    }
    renameFile(file, filename_new) {
        // if (/^[gimuy]+$/.test(this._optionsString) ||
        //     this._optionsString == '') {
        //     document.getElementById(this._optionsInputId).classList.remove('is-error');
        // } else {
        //     document.getElementById(this._optionsInputId).classList.add('is-error');
        // }

        if (this._replaceString == '') {
            return filename_new;
        } 

        try {
            var rgExp = new RegExp(this._replaceString, this._optionsString);
            var out = filename_new.replace(rgExp, this._replaceWith);
            document.getElementById(this._replaceStringInputId).classList.remove('is-error');
            return out;
        } catch(err) {
            document.getElementById(this._replaceStringInputId).classList.add('is-error');
            return '';
        }
    }
}


class renamingActionChangeCase extends renamingActionBase {
    constructor() {
        super();
        this._changeCaseInputId = 'inp-' + this._UUID;
        this._changeCaseOption = 'UPPER';

        this.buildHTML();
    }
    getTitle() {
        return 'Change Case';
    }
    getHTMLBody() {
        var newHTML = '';
        newHTML += '<select class="form-select" id="' + this._changeCaseInputId + '" onchange="FileRenamer.onAnyInput();">';
        newHTML += '<option value="1">UPPER CASE</option>';
        newHTML += '<option value="2">lower case</option>';
        newHTML += '<option value="3">Title Case</option>';
        newHTML += '<option value="4">Invert case</option>';
        newHTML += '</select>';
        return newHTML;
    }
    getHTMLValues() {
        var e = document.getElementById(this._changeCaseInputId);
        switch (e.options[e.selectedIndex].value) {
            case '2':
                this._changeCaseOption = 'LOWER';
                break;
            case '3':
                this._changeCaseOption = 'TITLE';
                break;
            case '4':
                this._changeCaseOption = 'INVERT';
                break;            
            default:
                this._changeCaseOption = 'UPPER';
                break;
        }
    }
    setHTMLValues() {
		var e = document.getElementById(this._changeCaseInputId);
		switch (this._changeCaseOption) {
            case 'LOWER':
            	e.value = '2';
            	break;
            case 'TITLE':
            	e.value = '3';
            	break;
            case 'INVERT':
            	e.value = '4';
            	break;
            default:
            	e.value = '1';
            	break;
		}
    }
    resetInternalState() {
        // Nothing to reset
    }
    renameFile(file, filename_new) {
        switch (this._changeCaseOption) {
            case 'UPPER':
                filename_new = filename_new.toUpperCase();
                break;
            case 'LOWER':
                filename_new = filename_new.toLowerCase();
                break;
            case 'TITLE':
                filename_new = filename_new.replace(/\w\S*/g, function(txt) {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                });
                break;
            case 'INVERT':
                var invertString = function (str) {
                    var s = '';
                    var i = 0;
                    while (i < str.length) {
                        var n = str.charAt(i);
                        if (n == n.toUpperCase()) {
                            // *Call* toLowerCase
                            n = n.toLowerCase();
                        } else {
                            // *Call* toUpperCase
                            n = n.toUpperCase();
                        }

                        i += 1;
                        s += n; 
                    }
                    return s;
                };
                filename_new = invertString(filename_new);
                break;
        }
        return filename_new;
    }
}



class renamingActionAddDate extends renamingActionBase {
    constructor() {
        super();
        this._typeOfDateInputId = 'opt-' + this._UUID;
        this._typeOfDate = 'LASTMOD';
        this._putWhereInputId = 'whr-' + this._UUID;
        this._putWhere = 'PREPEND';
        this._dateFormatterInputId = 'fmt-' + this._UUID;
        this._dateFormatter = '';

        this.buildHTML();
    }
    getTitle() {
        return 'Add Date';
    }
    getHTMLBody() {
        var newHTML = '';
        newHTML += '<label class="form-label" for="' + this._typeOfDateInputId + '">Type of Date & Option</label>'
        newHTML += '<table class="table-invisible"><tr><td>'
        newHTML += '<select class="form-select" id="' + this._typeOfDateInputId + '" onchange="FileRenamer.onAnyInput();">';
        newHTML += '<option value="1">Last Modified</option>';
        newHTML += '<option value="2">EXIF Creation</option>';
        newHTML += '</select>';
        newHTML += '</td><td>'
        newHTML += '<select class="form-select" id="' + this._putWhereInputId + '" onchange="FileRenamer.onAnyInput();">';
        newHTML += '<option value="1">Prepend</option>';
        newHTML += '<option value="2">Append</option>';
        newHTML += '</select>';   
        newHTML += '</td></tr></table>';

        newHTML += '<label class="form-label" for="' + this._dateFormatterInputId + '">Formatter</label>'
        newHTML += '<table class="table-invisible"><tr><td>'
        
        newHTML += '<input class="form-input" type="text" name="' + this._dateFormatterInputId + '"';
        newHTML += ' placeholder="MMMM Do YYYY, h:mm:ss a"';
        newHTML += ' id="' + this._dateFormatterInputId + '" oninput="FileRenamer.onAnyInput();"></input>';  

        newHTML += '</td><td class="text-center">'
        newHTML += '<a href="https://momentjs.com/docs/#/displaying/format/" target="_blank">';
        newHTML += '<figure class="avatar avatar-sm" data-initial="?"></figure></a>';   
        newHTML += '</td></tr></table>';
        return newHTML;
    }
    getHTMLValues() {
        var e = document.getElementById(this._typeOfDateInputId);
        switch (e.options[e.selectedIndex].value) {
            case '2':
                this._typeOfDate = 'EXIFCREATION';
                break;          
            default:
                this._typeOfDate = 'LASTMOD';
                break;
        }
        var el = document.getElementById(this._putWhereInputId);
        switch (el.options[el.selectedIndex].value) {
            case '2':
                this._putWhere = 'APPEND';
                break;          
            default:
                this._putWhere = 'PREPEND';
                break;
        }

        this._dateFormatter = document.getElementById(this._dateFormatterInputId).value;
    }
    setHTMLValues() {
		var e = document.getElementById(this._typeOfDateInputId);
		switch (this._typeOfDate) {
            case 'EXIFCREATION':
				e.value = '2';
				break;
			default:
				e.value = '1';
				break
		}
		var el = document.getElementById(this._putWhereInputId);
        switch (this._putWhere) {
            case 'APPEND':		
            	el.value = '2';
            	break;
            default:
            	el.value = '1';
            	break;
        }
        document.getElementById(this._dateFormatterInputId).value = this._dateFormatter;
    }
    resetInternalState() {
        // Nothing to reset
    }
    renameFile(file, filename_new) {
        switch (this._typeOfDate) {
            case 'LASTMOD':
                var mom = moment(file.lastModified);
                break;
            case 'EXIFCREATION':
                if (file.hasOwnProperty('exifdata')) {
                    var mom = moment(file.exifdata.DateTimeOriginal, 'YYYY:MM:DD HH:mm:ss');
                } else {
                    return filename_new;
                }
                break;
        }
        var dateString = mom.format(this._dateFormatter);
        switch (this._putWhere) {
            case 'APPEND':
                filename_new = filename_new + dateString;
                break;
            case 'PREPEND':
                filename_new = dateString + filename_new;
                break;
        }
        return filename_new;
    }
}


class renamingActionNoInteractionBase extends renamingActionBase {
    constructor() {
        super();

        this.buildHTML();
    }
    getHTMLBody() { return ''; }
    getHTMLValues() {}
    setHTMLValues() {}
    resetInternalState() {}
}

class renamingActionExtensionToLowerCase extends renamingActionNoInteractionBase{
	constructor() {
		super();
	}
	getTitle() {
		return 'Extension to Lowercase';
	}
	renameFile(file, filename_new, extension) {
		if (FileRenamer._ignoreExtensions) {
			return filename_new + '.' + extension.toLowerCase();
		}
		
		var split = filename_new.split('.')
		var extension = split.pop().toLowerCase();
		split.push(extension);
		return split.join('.');
	}
}

class renamingActionRemoveSpaces extends renamingActionBase{
    constructor() {
        super();

		this._chkLeading  = 'chk-leading-'  + this._UUID;
		this._chkTrailing = 'chk-trailing-' + this._UUID;
		this._chkDouble   = 'chk-double-' 	+ this._UUID;
		this._removeLeading  = true;
		this._removeTrailing = true;
		this._removeDouble   = true,

        this.buildHTML();
    }
    getTitle() {
        return 'Remove Spaces';
    }
    getHTMLBody() {
        var newHTML = '';
        newHTML += '<header class="navbar"><section class="navbar-section">';
        newHTML += '<label class="form-switch"><input type="checkbox"';
        newHTML += ' id="' + this._chkLeading + '" checked onchange="FileRenamer.onAnyInput();"/>';
		newHTML += '<i class="form-icon"></i>Leading</label>';

        newHTML += '<label class="form-switch"><input type="checkbox"';
        newHTML += ' id="' + this._chkTrailing + '" checked onchange="FileRenamer.onAnyInput();"/>';
		newHTML += '<i class="form-icon"></i>Trailing</label>';	

        newHTML += '<label class="form-switch"><input type="checkbox"';
        newHTML += ' id="' + this._chkDouble + '" checked onchange="FileRenamer.onAnyInput();"/>';
		newHTML += '<i class="form-icon"></i>Double</label>';

		newHTML += '</section></header>';			

        return newHTML;
    }
    getHTMLValues() {
        this._removeLeading  = document.getElementById(this._chkLeading).checked;
        this._removeTrailing = document.getElementById(this._chkTrailing).checked;
        this._removeDouble   = document.getElementById(this._chkDouble).checked;
    }
    setHTMLValues() {
        document.getElementById(this._chkLeading).checked  = this._removeLeading;
        document.getElementById(this._chkTrailing).checked = this._removeTrailing;
        document.getElementById(this._chkDouble).checked   = this._removeDouble;	
    }
    resetInternalState() {
        // Nothing to reset
    }
    renameFile(file, filename_new) {
    	var filename_out = filename_new;
    	if (this._removeLeading == true) {
    		filename_out = filename_out.trimLeft();
    	}

    	if (this._removeTrailing == true) {
    		filename_out = filename_out.trimRight();
    	}

    	if (this._removeDouble == true) {
			filename_out = filename_out.replace(/\s\s+/g, ' ');
    	}

    	return filename_out;
    }	
}

class renamingActionDeleteLeadingString extends renamingActionBase {
    constructor() {
        super();
        this._shiftLeftInputId       = 'inp-' + this._UUID;
        this._shiftLeftInputSliderId = 'inp-slider-' + this._UUID;
        this._shiftLeftNumber = 0;

        this.buildHTML();
    }
    getTitle() {
        return 'Delete Leading n Characters';
    }
    getHTMLBody() {
        var newHTML = '';
        newHTML += '<table class="table-invisible"><tr><td>'
        newHTML += '<input class="form-input auto-width" type="number" name="' + this._shiftLeftInputId  + '"';
        newHTML += ' id="' + this._shiftLeftInputId + '" oninput="FileRenamer.onAnyInput();" placeholder="0" value="0" min="0" />';
        newHTML += '</td><td>'
        newHTML += '<input class="slider" id="' + this._shiftLeftInputSliderId + '"';
        newHTML += ' type="range" min="0" max="30" value="0" oninput="';
        newHTML += "FileRenamer.onRangeForInput('" + this._shiftLeftInputId + "');" + '"/>';
        newHTML += '</td></tr></table>';
        return newHTML;
    }
    getHTMLValues() {
        this._shiftLeftNumber = document.getElementById(this._shiftLeftInputId).value;
    }
    setHTMLValues() {
    	document.getElementById(this._shiftLeftInputId).value = this._shiftLeftNumber;
    	document.getElementById(this._shiftLeftInputSliderId).value = this._shiftLeftNumber;
    }
    resetInternalState() {
        // Nothing to reset
    }
    renameFile(file, filename_new) {
        return filename_new.substr(this._shiftLeftNumber);
    }
}

class renamingActionDeleteTrailingString extends renamingActionBase {
    constructor() {
        super();
        this._shiftRightInputId       = 'inp-' + this._UUID;
        this._shiftRightInputSliderId = 'inp-slider-' + this._UUID;
        this._shiftRightNumber = 0;

        this.buildHTML();
    }
    getTitle() {
        return 'Delete Trailing n Characters';
    }
    getHTMLBody() {
        var newHTML = '';
        newHTML += '<table class="table-invisible"><tr><td>'
        newHTML += '<input class="form-input auto-width" type="number" name="' + this._shiftRightInputId  + '"';
        newHTML += ' id="' + this._shiftRightInputId + '" oninput="FileRenamer.onAnyInput();" placeholder="0" value="0" min="0" />';
        newHTML += '</td><td>'
        newHTML += '<input class="slider" id="' + this._shiftRightInputSliderId + '"';
        newHTML += ' type="range" min="0" max="30" value="0" oninput="';
        newHTML += "FileRenamer.onRangeForInput('" + this._shiftRightInputId + "');" + '"/>';
        newHTML += '</td></tr></table>';
        return newHTML;
    }
    getHTMLValues() {
        this._shiftRightNumber = document.getElementById(this._shiftRightInputId).value;
    }
    setHTMLValues() {
		document.getElementById(this._shiftRightInputId).value = this._shiftRightNumber;
		document.getElementById(this._shiftRightInputSliderId).value = this._shiftRightNumber;
    }
    resetInternalState() {
        // Nothing to reset
    }
    renameFile(file, filename_new) {
        return filename_new.substring(0, filename_new.length - this._shiftRightNumber);
    }
}


class renamingActionAddSequence extends renamingActionBase {
    constructor() {
        super();
        this._startNumberInputId = 'str-' + this._UUID;
        this._startNumber = 1;
        this._putWhereInputId = 'whr-' + this._UUID;
        this._putWhere = 'PREPEND';
        this._stepValueInputId = 'stv-' + this._UUID;
        this._stepValue;
        this._paddingInputId = 'pad-' + this._UUID;
        this._padding = 0;

        this._currentNumber = this._startNumber;

        this.buildHTML();
    }
    getTitle() {
        return 'Add Sequence';
    }
    getHTMLBody() {
        var newHTML = '';
        newHTML += '<label class="form-label" for="' + this._startNumberInputId + '">Start Number & Location</label>'
        newHTML += '<table class="table-invisible"><tr><td>';
        newHTML += '<input class="form-input" type="number" name="' + this._startNumberInputId + '" min="0" value="1"';
        newHTML += ' id="' + this._startNumberInputId + '" oninput="FileRenamer.onAnyInput();"></input>';
        newHTML += '</td><td>';
        newHTML += '<select class="form-select" id="' + this._putWhereInputId + '" onchange="FileRenamer.onAnyInput();">';
        newHTML += '<option value="1">Prepend</option>';
        newHTML += '<option value="2">Append</option>';
        newHTML += '</select>';      
        newHTML += '</td></tr></table>';

        newHTML += '<label class="form-label" for="' + this._stepValueInputId + '">Step Value & Padding</label>'
        newHTML += '<table class="table-invisible"><tr><td>';
        newHTML += '<input class="form-input" type="number" name="' + this._stepValueInputId + '" min="1" value="1"';
        newHTML += ' id="' + this._stepValueInputId + '" oninput="FileRenamer.onAnyInput();"></input>';        
        newHTML += '</td><td>';
        newHTML += '<input class="form-input" type="number" name="' + this._paddingInputId + '" min="0"';
        newHTML += ' id="' + this._paddingInputId + '" oninput="FileRenamer.onAnyInput();"></input>';         
        newHTML += '</td></tr></table>';

        return newHTML;
    }
    getHTMLValues() {
        this._startNumber = document.getElementById(this._startNumberInputId).value;
        this._stepValue   = document.getElementById(this._stepValueInputId).value;
        this._padding     = document.getElementById(this._paddingInputId).value;

        var e = document.getElementById(this._putWhereInputId);
        switch (e.options[e.selectedIndex].value) {
            case '2':
                this._putWhere = 'APPEND';
                break;          
            default:
                this._putWhere = 'PREPEND';
                break;
        }
    }
    setHTMLValues() {
        document.getElementById(this._startNumberInputId).value = this._startNumber;
        document.getElementById(this._stepValueInputId).value   = this._stepValue;
        document.getElementById(this._paddingInputId).value     = this._padding;	
        var e = document.getElementById(this._putWhereInputId);
        switch (this._putWhere) {
            case 'APPEND':
                e.value = '2';
                break;          
            default:
                e.value = '1';
                break;
        }        	
    }
    resetInternalState() {
        this._currentNumber = this._startNumber;
    }
    renameFile(file, filename_new) {
        function pad(n, width, z) {
            z = z || '0';
            n = n + '';
            return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
        }

        var counterString = this._currentNumber;
        counterString = pad(counterString,this._padding);

        // Counter++ for the next run
        this._currentNumber = Number(this._currentNumber) + Number(this._stepValue);

        switch (this._putWhere) {
            case 'APPEND':
                filename_new = filename_new + counterString;
                break;
            case 'PREPEND':
                filename_new = counterString + filename_new;
                break;
        }
        return filename_new;
    }
}

var UUIDGenerator = {
	_uuids: [],

	generate: function() {
		var newUUID = this._s4() + this._s4() + '-' + this._s4() + this._s4() + this._s4();
		if (this._uuids.includes(newUUID)) {
			return this.generate();
		}
		this._uuids.push(newUUID);
		return newUUID;
	},
	_s4: function() {
	    return Math.floor((1 + Math.random()) * 0x10000)
	      .toString(16)
	      .substring(1);
	},
}
