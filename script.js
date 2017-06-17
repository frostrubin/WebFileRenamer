var FileRenamer = {
	_actions: [],
	_files: [],
    _keepFileSelectOrder: false,
    _filesOriginalOrder: [],
	_ignoreExtensions: true,
    _filterByError: false,
    _cancelRenaming: false,

    onPageLoad: function() {
        // this.addFileInputListener();

        var list = document.getElementById('action-list');
        Sortable.create(list, {onSort: function(evt){
            FileRenamer.onActionReorder();
        }, handle:'.drag-handle' });
    },
    onFileSelected: function() {
        var elem = document.getElementById('upload-file-input'); 
    
        for (var file of elem.files) {
            FileRenamer._addFile(file);
        }
    },
    _addFile: function(file) {
        for (i = 0; i < this._files.length; i++) {
            if (file.name == this._files[i].name) {
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
                FileRenamer.onAnyInput();   
            });
        } else {
            FileRenamer._files.push(file);
            FileRenamer._filesOriginalOrder.push(file);
            FileRenamer._sortFiles();
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
    onRenameFiles: function() {
        this._cancelRenaming = false;
        var progress = document.getElementById('renaming-progress');
        progress.value = 1;
        var overlay = document.getElementById('renaming-overlay');
        overlay.classList.add('active');

        var currentCount = 0;
        var targetCount = this._files.length;
    	for (var file of this._files) {
            currentCount = currentCount + 1;
    		var fileReader = new FileReader();
    		fileReader.onload = function(e) {
    			//console.log(e);
    			//console.log(e.target);
    			var arrayBuffer = e.target.result; //this.result
    			FileRenamer._saveFile(e.target.zFileName, arrayBuffer, e.target.zMimeType);
    		};
    		fileReader.zFileName = file.zNewFileName;
    		fileReader.zMimeType = file.type;
    		fileReader.readAsArrayBuffer(file);
            
            if (this._cancelRenaming == true) {
                this._cancelRenaming = false;
                break;
            }


            progress.value = Number(currentCount / targetCount);
    	}

        overlay.classList.remove('active');
    	this.onAnyInput(); 	
    },
    onClearFiles: function() {
    	this._files = [];

    	this.onAnyInput();
    },
    keepPreviewCurrent: function() {
    	var container = document.getElementById('preview-table-body');
    	
    	if (this._files.length > 0) {
    		this.enableButton('btn-rename');
    		this.enableButton('btn-clear-files');
    	} else {
    		this.disableButton('btn-rename');
    		this.disableButton('btn-clear-files');
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
        var errorsExist = false;
        for (var file of this._files) {
            if (file.zNewFileNameIsValid == false) {
                errorsExist = true;
                break;
            }
        } 

        var toast = document.getElementById('validation-toast');
        if (errorsExist == true) {
            toast.classList.remove('toast-success');
            toast.classList.add('toast-error');
            toast.innerText = 'Validation failed ';
            this.disableButton('btn-rename');
            toast.style.display = 'initial';
            newHTML = 'Validation failed<i class="material-icons">';
            if (this._filterByError == true) {
                newHTML += 'turned_in</i>';
            } else {
                newHTML += 'turned_in_not</i>';
            }
            toast.innerHTML = newHTML;
        } else {
            this._filterByError = false;
            if (this._files.length > 0) {
                toast.classList.add('toast-success');
                toast.classList.remove('toast-error');
                toast.innerText = 'Validation OK';
                this.enableButton('btn-rename');
                toast.style.display = 'initial';
            } else {
                toast.classList.remove('toast-success');
                toast.classList.remove('toast-error');
                toast.style.display = 'none';
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
    },
    calculateNewNameForFile: function(file) {
    	var filename_new = file.name
    	var extension = '';

    	if (this._ignoreExtensions) {
    		extension = filename_new.split('.').pop();
    		filename_new = this.removeExtension(filename_new);
    	}

    	for (var action of this._actions) {
    		filename_new = action.renameFile(file, filename_new);
    	}

    	if (extension != '') {
    		filename_new = filename_new + '.' + extension;
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
    onAddAction: function(actionName) {
    	var newAction = new Object;
		switch (actionName) {
		  	case 'stringAdd':
		  		newAction = new renamingActionAddString();
		    	break;
		  	case 'stringReplace':
		  		newAction = new renamingActionReplaceString();
                break;
            case 'stringRegexReplace':
                newAction = new renamingActionReplaceRegexString();
                break;            
            case 'stringDeleteLeading':
                newAction = new renamingActionDeleteLeadingString();
		  		break;
            case 'stringDeleteTrailing':
                newAction = new renamingActionDeleteTrailingString();
                break;       
            case 'stringChangeCase':
                newAction = new renamingActionChangeCase();
                break;     
            case 'addDate':
                newAction = new renamingActionAddDate();
                break;
            case 'addSequence':
                newAction = new renamingActionAddSequence();
                break;
            case 'removeLeadingSpaces':
                newAction = new renamingActionTrimLeft();
                break;
            case 'removeTrailingSpaces':
                newAction = new renamingActionTrimRight();
                break;
            case 'removeDoubleSpaces':
                newAction = new renamingActionRemoveDoubleSpaces();
                break;                                                
		  	default:
		  		throw('Unknown Action!');
		}
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
        document.getElementById('renaming-overlay').classList.remove('active');
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
  		if (document.getElementById(this._liID) === null) {
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
    getHTMLBody() {
        return '';
    }
    getHTMLValues() {
    }
    resetInternalState() {
    }
}

class renamingActionTrimLeft extends renamingActionNoInteractionBase {
    getTitle() {
        return 'Remove Leading Spaces';
    }
    renameFile(file, filename_new) {
        return filename_new.trimLeft();
    }
}

class renamingActionTrimRight extends renamingActionNoInteractionBase {
    getTitle() {
        return 'Remove Trailing Spaces';
    }
    renameFile(file, filename_new) {
        return filename_new.trimRight();
    }
}

class renamingActionRemoveDoubleSpaces extends renamingActionNoInteractionBase {
    getTitle() {
        return 'Remove Double Spaces';
    }
    renameFile(file, filename_new) {
        return filename_new.replace(/\s\s+/g, ' ');
    }    
}


class renamingActionDeleteLeadingString extends renamingActionBase {
    constructor() {
        super();
        this._shiftLeftInputId = 'inp-' + this._UUID;
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
        newHTML += '<input class="slider" type="range" min="0" max="30" value="0" oninput="';
        newHTML += "FileRenamer.onRangeForInput('" + this._shiftLeftInputId + "');" + '"/>';
        newHTML += '</td></tr></table>';
        return newHTML;
    }
    getHTMLValues() {
        this._shiftLeftNumber = document.getElementById(this._shiftLeftInputId).value;
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
        this._shiftRightInputId = 'inp-' + this._UUID;
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
        newHTML += '<input class="slider" type="range" min="0" max="30" value="0" oninput="';
        newHTML += "FileRenamer.onRangeForInput('" + this._shiftRightInputId + "');" + '"/>';
        newHTML += '</td></tr></table>';
        return newHTML;
    }
    getHTMLValues() {
        this._shiftRightNumber = document.getElementById(this._shiftRightInputId).value;
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