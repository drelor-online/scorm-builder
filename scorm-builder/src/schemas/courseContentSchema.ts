// JSON Schema for CourseContent validation
export const courseContentSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "welcomePage": {
      "type": "object",
      "required": ["title", "content"],
      "properties": {
        "id": { "type": "string" },
        "title": { 
          "type": "string",
          "description": "Title of the welcome page"
        },
        "content": { 
          "type": "string",
          "description": "HTML content for the welcome page"
        },
        "narration": { 
          "type": "string",
          "description": "Narration text for the welcome page"
        },
        "imageKeywords": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Keywords for image generation"
        },
        "imagePrompts": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Prompts for AI image generation"
        },
        "videoSearchTerms": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Search terms for video content"
        },
        "duration": {
          "type": "number",
          "minimum": 0,
          "description": "Duration in minutes"
        }
      }
    },
    "learningObjectivesPage": {
      "type": "object",
      "required": ["title", "content"],
      "properties": {
        "id": { "type": "string" },
        "title": { 
          "type": "string",
          "description": "Title of the learning objectives page"
        },
        "content": { 
          "type": "string",
          "description": "HTML content for the learning objectives"
        },
        "narration": { 
          "type": "string",
          "description": "Narration text for the learning objectives"
        },
        "imageKeywords": {
          "type": "array",
          "items": { "type": "string" }
        },
        "imagePrompts": {
          "type": "array",
          "items": { "type": "string" }
        },
        "videoSearchTerms": {
          "type": "array",
          "items": { "type": "string" }
        },
        "duration": {
          "type": "number",
          "minimum": 0
        }
      }
    },
    "topics": {
      "type": "array",
      "description": "Array of course topics",
      "items": {
        "type": "object",
        "required": ["id", "title", "content"],
        "properties": {
          "id": { 
            "type": "string",
            "pattern": "^topic-\\d+$",
            "description": "Topic ID (format: topic-0, topic-1, etc.)"
          },
          "title": { 
            "type": "string",
            "description": "Topic title"
          },
          "content": { 
            "type": "string",
            "description": "HTML content for the topic"
          },
          "narration": { 
            "type": "string",
            "description": "Narration text for the topic"
          },
          "imageKeywords": {
            "type": "array",
            "items": { "type": "string" }
          },
          "imagePrompts": {
            "type": "array",
            "items": { "type": "string" }
          },
          "videoSearchTerms": {
            "type": "array",
            "items": { "type": "string" }
          },
          "duration": {
            "type": "number",
            "minimum": 0
          },
          "knowledgeCheck": {
            "type": "object",
            "properties": {
              "enabled": { "type": "boolean" },
              "questions": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["type", "question"],
                  "properties": {
                    "id": { "type": "string" },
                    "type": {
                      "type": "string",
                      "enum": ["multiple-choice", "true-false", "fill-in-the-blank"],
                      "description": "Type of question"
                    },
                    "question": { 
                      "type": "string",
                      "description": "The question text"
                    },
                    "text": { 
                      "type": "string",
                      "description": "Alternative to 'question' field"
                    },
                    "options": {
                      "type": "array",
                      "items": { "type": "string" },
                      "description": "Options for multiple-choice questions"
                    },
                    "correctAnswer": {
                      "type": ["string", "boolean"],
                      "description": "The correct answer"
                    },
                    "blank": {
                      "type": "string",
                      "description": "Text with blank for fill-in-the-blank questions"
                    },
                    "feedback": {
                      "type": "object",
                      "properties": {
                        "correct": { 
                          "type": "string",
                          "description": "Feedback when answer is correct"
                        },
                        "incorrect": { 
                          "type": "string",
                          "description": "Feedback when answer is incorrect"
                        }
                      }
                    },
                    "explanation": {
                      "type": "string",
                      "description": "Explanation of the answer"
                    },
                    "correct_feedback": {
                      "type": "string",
                      "description": "Alternative feedback for correct answer"
                    },
                    "incorrect_feedback": {
                      "type": "string",
                      "description": "Alternative feedback for incorrect answer"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "assessment": {
      "type": "object",
      "description": "Final assessment configuration",
      "properties": {
        "passMark": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Passing score percentage"
        },
        "narration": { 
          "type": "string",
          "description": "Narration for assessment"
        },
        "questions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["type", "question"],
            "properties": {
              "id": { "type": "string" },
              "type": {
                "type": "string",
                "enum": ["multiple-choice", "true-false", "fill-in-the-blank"]
              },
              "question": { "type": "string" },
              "options": {
                "type": "array",
                "items": { "type": "string" }
              },
              "correctAnswer": {
                "type": ["string", "boolean"]
              },
              "feedback": {
                "type": "object",
                "properties": {
                  "correct": { "type": "string" },
                  "incorrect": { "type": "string" }
                }
              }
            }
          }
        }
      }
    }
  },
  "additionalProperties": true
}