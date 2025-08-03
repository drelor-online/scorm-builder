// SCORM 1.2 API Implementation
window.scormAPI = {
    LMSInitialize: function(param) {
        console.log('SCORM: Initialize', param);
        return "true";
    },
    
    LMSSetValue: function(element, value) {
        console.log('SCORM: SetValue', element, value);
        // Store values in localStorage for persistence
        localStorage.setItem('scorm_' + element, value);
        return "true";
    },
    
    LMSGetValue: function(element) {
        console.log('SCORM: GetValue', element);
        // Retrieve values from localStorage
        return localStorage.getItem('scorm_' + element) || "";
    },
    
    LMSCommit: function(param) {
        console.log('SCORM: Commit', param);
        return "true";
    },
    
    LMSFinish: function(param) {
        console.log('SCORM: Finish', param);
        return "true";
    },
    
    LMSGetLastError: function() {
        return "0";
    },
    
    LMSGetErrorString: function(errorCode) {
        return "No error";
    },
    
    LMSGetDiagnostic: function(errorCode) {
        return "No diagnostic information";
    }
};

// Make API available as both API and API_1484_11 for compatibility
window.API = window.scormAPI;