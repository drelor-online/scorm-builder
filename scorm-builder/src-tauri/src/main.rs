// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // For debug builds, show immediate debugging output
    #[cfg(debug_assertions)]
    {
        println!("=== SCORM Builder Debug Build Starting ===");
        println!("Console should be visible now!");
        println!("If you see this, console allocation worked.");

        // For Windows, ensure console is allocated
        #[cfg(target_os = "windows")]
        {
            unsafe {
                use winapi::um::consoleapi::AllocConsole;
                use winapi::um::wincon::{AttachConsole, ATTACH_PARENT_PROCESS};

                // Try to attach to parent console first (if launched from cmd)
                if AttachConsole(ATTACH_PARENT_PROCESS) == 0 {
                    // If no parent console, allocate a new one
                    AllocConsole();
                    println!("Allocated new console window");
                } else {
                    println!("Attached to parent console");
                }
            }
        }

        println!("Starting Tauri application...");
    }

    scorm_builder_lib::run()
}
