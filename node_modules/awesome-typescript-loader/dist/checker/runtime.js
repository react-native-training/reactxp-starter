"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
if (!module.parent) {
    process.on('uncaughtException', function (err) {
        console.log("UNCAUGHT EXCEPTION in awesome-typescript-loader");
        console.log("[Inside 'uncaughtException' event] ", err.message, err.stack);
    });
    process.on('disconnect', function () {
        process.exit();
    });
    process.on('exit', function () {
        console.log('EXIT RUNTIME');
    });
    createChecker(process.on.bind(process, 'message'), process.send.bind(process));
}
else {
    module.exports.run = function run() {
        var send;
        var receive = function (msg) { };
        createChecker(function (receive) {
            send = function (msg, cb) {
                receive(msg);
                if (cb) {
                    cb();
                }
            };
        }, function (msg) { return receive(msg); });
        return {
            on: function (type, cb) {
                if (type === 'message') {
                    receive = cb;
                }
            },
            send: send,
            kill: function () { }
        };
    };
}
var path = require("path");
var colors = require("colors");
var helpers_1 = require("../helpers");
var protocol_1 = require("./protocol");
function createChecker(receive, send) {
    var projectVersion = 0;
    var loaderConfig;
    var compilerConfig;
    var compilerOptions;
    var webpackOptions;
    var compiler;
    var compilerInfo;
    var files = {};
    var host;
    var service;
    var ignoreDiagnostics = {};
    var instanceName;
    var context;
    function ensureFile(fileName) {
        if (!files[fileName]) {
            var text = compiler.sys.readFile(fileName);
            if (text) {
                files[fileName] = {
                    text: text,
                    version: 0,
                    snapshot: compiler.ScriptSnapshot.fromString(text)
                };
            }
        }
    }
    var FileDeps = (function () {
        function FileDeps() {
            this.files = {};
        }
        FileDeps.prototype.add = function (containingFile) {
            var dep = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                dep[_i - 1] = arguments[_i];
            }
            if (!this.files[containingFile]) {
                this.files[containingFile] = Array.from(dep);
            }
            else {
                var deps = this.files[containingFile];
                deps.push.apply(deps, dep);
            }
        };
        FileDeps.prototype.getDeps = function (containingFile) {
            return this.files[containingFile] || [];
        };
        FileDeps.prototype.getAllDeps = function (containingFile, allDeps, initial) {
            var _this = this;
            if (allDeps === void 0) { allDeps = {}; }
            if (initial === void 0) { initial = true; }
            var deps = this.getDeps(containingFile);
            deps.forEach(function (dep) {
                if (!allDeps[dep]) {
                    allDeps[dep] = true;
                    _this.getAllDeps(dep, allDeps, false);
                }
            });
            if (initial) {
                return Object.keys(allDeps);
            }
            else {
                return [];
            }
        };
        return FileDeps;
    }());
    var fileDeps = new FileDeps();
    var TS_AND_JS_FILES = /\.tsx?$|\.jsx?$/i;
    var TS_FILES = /\.tsx?$/i;
    var Host = (function () {
        function Host(filesRegex) {
            this.filesRegex = filesRegex;
        }
        Host.prototype.getProjectVersion = function () { return projectVersion.toString(); };
        Host.prototype.getScriptFileNames = function () {
            var _this = this;
            return Object.keys(files).filter(function (filePath) { return _this.filesRegex.test(filePath); });
        };
        Host.prototype.getScriptVersion = function (fileName) {
            ensureFile(fileName);
            if (files[fileName]) {
                return files[fileName].version.toString();
            }
        };
        Host.prototype.getScriptSnapshot = function (fileName) {
            ensureFile(fileName);
            if (files[fileName]) {
                return files[fileName].snapshot;
            }
        };
        Host.prototype.getCurrentDirectory = function () {
            return context;
        };
        Host.prototype.getScriptIsOpen = function () {
            return true;
        };
        Host.prototype.getCompilationSettings = function () {
            return compilerOptions;
        };
        Host.prototype.resolveTypeReferenceDirectives = function (typeDirectiveNames, containingFile) {
            var resolved = typeDirectiveNames.map(function (directive) {
                return compiler.resolveTypeReferenceDirective(directive, containingFile, compilerOptions, compiler.sys)
                    .resolvedTypeReferenceDirective;
            });
            resolved.forEach(function (res) {
                if (res && res.resolvedFileName) {
                    fileDeps.add(containingFile, res.resolvedFileName);
                }
            });
            return resolved;
        };
        Host.prototype.resolveModuleNames = function (moduleNames, containingFile) {
            var resolved = moduleNames.map(function (module) {
                return compiler.resolveModuleName(module, containingFile, compilerOptions, compiler.sys).resolvedModule;
            });
            resolved.forEach(function (res) {
                if (res && res.resolvedFileName) {
                    fileDeps.add(containingFile, res.resolvedFileName);
                }
            });
            return resolved;
        };
        Host.prototype.log = function (message) {
            console.log(message);
        };
        Host.prototype.fileExists = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return compiler.sys.fileExists.apply(compiler.sys, args);
        };
        Host.prototype.readFile = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return compiler.sys.readFile.apply(compiler.sys, args);
        };
        Host.prototype.readDirectory = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return compiler.sys.readDirectory.apply(compiler.sys, args);
        };
        Host.prototype.getDefaultLibFileName = function (options) {
            return compiler.getDefaultLibFilePath(options);
        };
        Host.prototype.useCaseSensitiveFileNames = function () {
            return compiler.sys.useCaseSensitiveFileNames;
        };
        Host.prototype.getDirectories = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return compiler.sys.getDirectories.apply(compiler.sys, args);
        };
        Host.prototype.directoryExists = function (path) {
            return compiler.sys.directoryExists(path);
        };
        return Host;
    }());
    function processInit(_a) {
        var seq = _a.seq, payload = _a.payload;
        compiler = require(payload.compilerInfo.compilerPath);
        compilerInfo = payload.compilerInfo;
        loaderConfig = payload.loaderConfig;
        compilerConfig = payload.compilerConfig;
        compilerOptions = compilerConfig.options;
        webpackOptions = payload.webpackOptions;
        context = payload.context;
        instanceName = loaderConfig.instance || 'at-loader';
        host = new Host(compilerOptions.allowJs
            ? TS_AND_JS_FILES
            : TS_FILES);
        service = compiler.createLanguageService(host);
        compilerConfig.fileNames.forEach(function (fileName) {
            var text = compiler.sys.readFile(fileName);
            if (!text) {
                return;
            }
            files[fileName] = {
                text: text,
                version: 0,
                snapshot: compiler.ScriptSnapshot.fromString(text)
            };
        });
        var program = service.getProgram();
        program.getSourceFiles().forEach(function (file) {
            files[file.fileName] = {
                text: file.text,
                version: 0,
                snapshot: compiler.ScriptSnapshot.fromString(file.text)
            };
        });
        if (loaderConfig.debug) {
            console.log("[" + instanceName + "] @DEBUG Initial files", Object.keys(files));
        }
        if (loaderConfig.ignoreDiagnostics) {
            loaderConfig.ignoreDiagnostics.forEach(function (diag) {
                ignoreDiagnostics[diag] = true;
            });
        }
        replyOk(seq, null);
    }
    function updateFile(fileName, text, ifExist) {
        if (ifExist === void 0) { ifExist = false; }
        var file = files[fileName];
        if (file) {
            if (file.text === text) {
                return;
            }
            projectVersion++;
            file.version++;
            file.text = text;
            file.snapshot = compiler.ScriptSnapshot.fromString(text);
        }
        else if (!ifExist) {
            projectVersion++;
            files[fileName] = {
                text: text,
                version: 0,
                snapshot: compiler.ScriptSnapshot.fromString(text)
            };
        }
    }
    function removeFile(fileName) {
        var file = files[fileName];
        if (file) {
            delete files[fileName];
        }
    }
    function emit(fileName) {
        if (loaderConfig.useTranspileModule || loaderConfig.transpileOnly) {
            return fastEmit(fileName);
        }
        else {
            var output = service.getEmitOutput(fileName, false);
            if (output.outputFiles.length > 0) {
                return helpers_1.findResultFor(fileName, output);
            }
            else {
                return fastEmit(fileName);
            }
        }
    }
    function fastEmit(fileName) {
        var trans = compiler.transpileModule(files[fileName].text, {
            compilerOptions: compilerOptions,
            fileName: fileName,
            reportDiagnostics: false
        });
        return {
            text: trans.outputText,
            sourceMap: trans.sourceMapText
        };
    }
    function processUpdate(_a) {
        var seq = _a.seq, payload = _a.payload;
        updateFile(payload.fileName, payload.text, payload.ifExist);
        replyOk(seq, null);
    }
    function processRemove(_a) {
        var seq = _a.seq, payload = _a.payload;
        removeFile(payload.fileName);
        replyOk(seq, null);
    }
    function processEmit(_a) {
        var seq = _a.seq, payload = _a.payload;
        updateFile(payload.fileName, payload.text);
        var emitResult = emit(payload.fileName);
        var deps = fileDeps.getAllDeps(payload.fileName);
        replyOk(seq, { emitResult: emitResult, deps: deps });
    }
    function processFiles(_a) {
        var seq = _a.seq;
        replyOk(seq, {
            files: service.getProgram().getSourceFiles().map(function (f) { return f.fileName; })
        });
    }
    function processDiagnostics(_a) {
        var seq = _a.seq;
        var silent = !!loaderConfig.silent;
        var timeStart = +new Date();
        if (!silent) {
            console.log(colors.cyan("\n[" + instanceName + "] Checking started in a separate process..."));
        }
        var program = service.getProgram();
        var allDiagnostics = program
            .getOptionsDiagnostics().concat(program.getGlobalDiagnostics());
        var nativeGetter = program.getSourceFiles;
        if (compilerConfig.options.skipLibCheck) {
            program.getSourceFiles = function () { return nativeGetter().filter(function (file) {
                return !file.isDeclarationFile;
            }); };
        }
        allDiagnostics.push.apply(allDiagnostics, program.getSyntacticDiagnostics());
        allDiagnostics.push.apply(allDiagnostics, program.getSemanticDiagnostics());
        if (loaderConfig.debug) {
            console.log("[" + instanceName + "] @DEBUG Typechecked files", program.getSourceFiles());
        }
        program.getSourceFiles = nativeGetter;
        if (allDiagnostics.length) {
            console.error(colors.red("\n[" + instanceName + "] Checking finished with " + allDiagnostics.length + " errors"));
        }
        else {
            if (!silent) {
                var timeEnd = +new Date();
                console.log(colors.green("\n[" + instanceName + "] Ok, " + (timeEnd - timeStart) / 1000 + " sec."));
            }
        }
        var processedDiagnostics = allDiagnostics
            .filter(function (diag) { return !ignoreDiagnostics[diag.code]; })
            .map(function (diagnostic) {
            var message = compiler.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            var fileName = diagnostic.file && path.relative(context, diagnostic.file.fileName);
            if (fileName && fileName[0] !== '.') {
                fileName = './' + helpers_1.toUnix(fileName);
            }
            var pretty = '';
            var line = 0;
            var character = 0;
            var code = diagnostic.code;
            if (diagnostic.file) {
                var pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                line = pos.line;
                character = pos.character;
                pretty = ("[" + instanceName + "] " + colors.red(fileName) + ":" + (line + 1) + ":" + (character + 1) + " \n    TS" + code + ": " + colors.red(message));
            }
            else {
                pretty = (colors.red("[" + instanceName + "] TS" + code + ": " + message));
            }
            return {
                category: diagnostic.category,
                code: diagnostic.code,
                fileName: fileName,
                start: diagnostic.start,
                message: message,
                pretty: pretty,
                line: line,
                character: character
            };
        });
        replyOk(seq, processedDiagnostics);
    }
    function replyOk(seq, payload) {
        send({
            seq: seq,
            success: true,
            payload: payload
        });
    }
    function replyErr(seq, payload) {
        send({
            seq: seq,
            success: false,
            payload: payload
        });
    }
    receive(function (req) {
        try {
            switch (req.type) {
                case protocol_1.MessageType.Init:
                    processInit(req);
                    break;
                case protocol_1.MessageType.UpdateFile:
                    processUpdate(req);
                    break;
                case protocol_1.MessageType.EmitFile:
                    processEmit(req);
                    break;
                case protocol_1.MessageType.Diagnostics:
                    processDiagnostics(req);
                    break;
                case protocol_1.MessageType.Files:
                    processFiles(req);
                    break;
                case protocol_1.MessageType.RemoveFile:
                    processRemove(req);
                    break;
            }
        }
        catch (e) {
            console.error("[" + instanceName + "]: Child process failed to process the request: ", e);
            replyErr(req.seq, null);
        }
    });
}
//# sourceMappingURL=runtime.js.map