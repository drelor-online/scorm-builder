/**
 * SCORM API Wrapper
 * Provides communication between course content and LMS
 * Supports both SCORM 1.2 and SCORM 2004
 */

(function() {
    'use strict';
    
    // Detect SCORM version
    var API = null;
    var API_1484_11 = null;
    var scormVersion = null;
    
    // Find SCORM API
    function findAPI(win) {
        var findAttempts = 0;
        var findAttemptLimit = 500;
        
        while ((win.API == null || win.API_1484_11 == null) && 
               (win.parent != null) && (win.parent != win) && 
               (findAttempts <= findAttemptLimit)) {
            findAttempts++;
            try {
                // Try to access parent window - may throw if cross-origin
                win = win.parent;
            } catch (e) {
                // Cross-origin access denied - stop searching
                break;
            }
        }
        
        try {
            if (win.API != null) {
                API = win.API;
                scormVersion = "1.2";
            } else if (win.API_1484_11 != null) {
                API_1484_11 = win.API_1484_11;
                scormVersion = "2004";
            }
        } catch (e) {
            // Cross-origin access denied for API check
            return false;
        }
        
        return (API != null || API_1484_11 != null);
    }
    
    // Initialize connection
    function doInitialize() {
        if (scormVersion === "1.2") {
            return API.LMSInitialize("");
        } else if (scormVersion === "2004") {
            return API_1484_11.Initialize("");
        }
        return "false";
    }
    
    // Terminate connection
    function doTerminate() {
        if (scormVersion === "1.2") {
            return API.LMSFinish("");
        } else if (scormVersion === "2004") {
            return API_1484_11.Terminate("");
        }
        return "false";
    }
    
    // Get value from LMS
    function doGetValue(element) {
        if (scormVersion === "1.2") {
            return API.LMSGetValue(element);
        } else if (scormVersion === "2004") {
            return API_1484_11.GetValue(element);
        }
        return "";
    }
    
    // Set value to LMS
    function doSetValue(element, value) {
        if (scormVersion === "1.2") {
            return API.LMSSetValue(element, value);
        } else if (scormVersion === "2004") {
            return API_1484_11.SetValue(element, value);
        }
        return "false";
    }
    
    // Commit data to LMS
    function doCommit() {
        if (scormVersion === "1.2") {
            return API.LMSCommit("");
        } else if (scormVersion === "2004") {
            return API_1484_11.Commit("");
        }
        return "false";
    }
    
    // Get last error
    function doGetLastError() {
        if (scormVersion === "1.2") {
            return API.LMSGetLastError();
        } else if (scormVersion === "2004") {
            return API_1484_11.GetLastError();
        }
        return "0";
    }
    
    // Get error string
    function doGetErrorString(errorCode) {
        if (scormVersion === "1.2") {
            return API.LMSGetErrorString(errorCode);
        } else if (scormVersion === "2004") {
            return API_1484_11.GetErrorString(errorCode);
        }
        return "No error";
    }
    
    // Get diagnostic
    function doGetDiagnostic(errorCode) {
        if (scormVersion === "1.2") {
            return API.LMSGetDiagnostic(errorCode);
        } else if (scormVersion === "2004") {
            return API_1484_11.GetDiagnostic(errorCode);
        }
        return "No diagnostic information available";
    }
    
    // Public SCORM wrapper object
    window.SCORM = {
        version: null,
        initialized: false,
        
        init: function() {
            if (findAPI(window)) {
                this.version = scormVersion;
                var result = doInitialize();
                this.initialized = (result === "true");
                
                if (this.initialized) {
                    // Set initial values
                    if (scormVersion === "1.2") {
                        doSetValue("cmi.core.lesson_status", "incomplete");
                    } else {
                        doSetValue("cmi.completion_status", "incomplete");
                    }
                }
                
                return this.initialized;
            }
            return false;
        },
        
        terminate: function() {
            if (this.initialized) {
                // Set exit and save session time
                if (scormVersion === "1.2") {
                    doSetValue("cmi.core.exit", "");
                } else {
                    doSetValue("cmi.exit", "normal");
                }
                
                doCommit();
                var result = doTerminate();
                this.initialized = false;
                return (result === "true");
            }
            return false;
        },
        
        getValue: function(element) {
            if (this.initialized) {
                return doGetValue(element);
            }
            return "";
        },
        
        setValue: function(element, value) {
            if (this.initialized) {
                return doSetValue(element, value) === "true";
            }
            return false;
        },
        
        commit: function() {
            if (this.initialized) {
                return doCommit() === "true";
            }
            return false;
        },
        
        getLastError: function() {
            return doGetLastError();
        },
        
        getErrorString: function(errorCode) {
            return doGetErrorString(errorCode);
        },
        
        getDiagnostic: function(errorCode) {
            return doGetDiagnostic(errorCode);
        },
        
        // Convenience methods
        setScore: function(raw, min, max) {
            if (scormVersion === "1.2") {
                this.setValue("cmi.core.score.raw", raw.toString());
                this.setValue("cmi.core.score.min", min.toString());
                this.setValue("cmi.core.score.max", max.toString());
            } else {
                this.setValue("cmi.score.raw", raw.toString());
                this.setValue("cmi.score.min", min.toString());
                this.setValue("cmi.score.max", max.toString());
                // Prevent division by zero
                if (max > 0) {
                    this.setValue("cmi.score.scaled", (raw / max).toString());
                } else {
                    this.setValue("cmi.score.scaled", "1.0");
                }
            }
        },
        
        setComplete: function() {
            if (scormVersion === "1.2") {
                this.setValue("cmi.core.lesson_status", "completed");
            } else {
                this.setValue("cmi.completion_status", "completed");
            }
        },
        
        setPassed: function() {
            if (scormVersion === "1.2") {
                this.setValue("cmi.core.lesson_status", "passed");
            } else {
                this.setValue("cmi.success_status", "passed");
                this.setValue("cmi.completion_status", "completed");
            }
        },
        
        setFailed: function() {
            if (scormVersion === "1.2") {
                this.setValue("cmi.core.lesson_status", "failed");
            } else {
                this.setValue("cmi.success_status", "failed");
                this.setValue("cmi.completion_status", "completed");
            }
        }
    };
    
    // Auto-initialize on page load
    window.addEventListener('load', function() {
        SCORM.init();
    });
    
    // Auto-terminate on page unload
    window.addEventListener('beforeunload', function() {
        // Only terminate if successfully initialized
        if (SCORM.initialized) {
            SCORM.terminate();
        }
    });
})();