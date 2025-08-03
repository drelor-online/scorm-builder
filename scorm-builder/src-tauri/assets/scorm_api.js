// SCORM 1.2 API Implementation
var API = {
    // SCORM 1.2 Required Methods
    LMSInitialize: function(param) {
        console.log('[SCORM API] LMSInitialize called');
        return "true";
    },
    
    LMSFinish: function(param) {
        console.log('[SCORM API] LMSFinish called');
        return "true";
    },
    
    LMSGetValue: function(element) {
        console.log('[SCORM API] LMSGetValue:', element);
        switch(element) {
            case 'cmi.core.student_name':
                return 'Test Student';
            case 'cmi.core.student_id':
                return '12345';
            case 'cmi.core.lesson_status':
                return 'incomplete';
            case 'cmi.core.lesson_mode':
                return 'normal';
            default:
                return '';
        }
    },
    
    LMSSetValue: function(element, value) {
        console.log('[SCORM API] LMSSetValue:', element, '=', value);
        return "true";
    },
    
    LMSCommit: function(param) {
        console.log('[SCORM API] LMSCommit called');
        return "true";
    },
    
    LMSGetLastError: function() {
        return "0";
    },
    
    LMSGetErrorString: function(errorCode) {
        return "No error";
    },
    
    LMSGetDiagnostic: function(errorCode) {
        return "No diagnostic information available";
    }
};

// Make API available to parent window
if (window.parent && window.parent !== window) {
    window.parent.API = API;
}