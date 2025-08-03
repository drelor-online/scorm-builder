import { describe, it, expect } from 'vitest'
import Handlebars from 'handlebars'

describe('Handlebars Template Rendering', () => {
  it('should render knowledge check correctly with the exact template', () => {
    // Register helpers
    Handlebars.registerHelper('eq', function(a, b, options) {
      // @ts-ignore
      return a === b ? options.fn(this) : options.inverse(this)
    })

    // Simplified topic template focusing on knowledge check
    const template = `
{{#if has_knowledge_check}}
<div class="knowledge-check-container">
    <h3>Knowledge Check</h3>
    
    {{#each knowledge_check_questions}}
    {{#if (eq type "multiple-choice")}}
    <div class="kc-question-wrapper" data-question-index="{{index}}">
        <p class="kc-question">{{text}}</p>
        <div class="kc-options">
            {{#each options}}
            <label class="kc-option">
                <input type="radio" 
                       name="q{{../index}}" 
                       value="{{this}}"
                       data-correct="{{../correct_answer}}"
                       data-feedback="{{../explanation}}">
                <span>{{this}}</span>
            </label>
            {{/each}}
        </div>
        <button class="kc-submit" onclick="window.submitMultipleChoice({{index}})">
            Submit Answer
        </button>
        <div id="feedback-{{index}}" class="feedback"></div>
    </div>
    {{else}}
        {{#if (eq type "true-false")}}
        <div class="kc-question-wrapper" data-question-index="{{index}}">
            <p class="kc-question">{{text}}</p>
            <div class="kc-options">
                <label class="kc-option">
                    <input type="radio" 
                           name="q{{index}}" 
                           value="true"
                           data-correct="{{correct_answer}}"
                           data-feedback="{{explanation}}">
                    <span>True</span>
                </label>
                <label class="kc-option">
                    <input type="radio" 
                           name="q{{index}}" 
                           value="false"
                           data-correct="{{correct_answer}}"
                           data-feedback="{{explanation}}">
                    <span>False</span>
                </label>
            </div>
            <button class="kc-submit" onclick="window.submitMultipleChoice({{index}})">
                Submit Answer
            </button>
            <div id="feedback-{{index}}" class="feedback"></div>
        </div>
        {{/if}}
    {{/if}}
    {{/each}}
</div>
{{else}}
<p>No knowledge check</p>
{{/if}}
`

    const compiledTemplate = Handlebars.compile(template)

    // Test data matching what Rust sends
    const data = {
      has_knowledge_check: true,
      knowledge_check_questions: [
        {
          type: "multiple-choice",
          text: "What is natural gas primarily composed of?",
          index: 0,
          correct_answer: "Methane",
          explanation: "Natural gas is primarily composed of methane (CH4)",
          options: ["Methane", "Propane", "Butane", "Ethane"]
        }
      ]
    }

    const result = compiledTemplate(data)
    
    // Check that it rendered
    expect(result).toContain('knowledge-check-container')
    expect(result).toContain('What is natural gas primarily composed of?')
    expect(result).toContain('Methane')
    expect(result).toContain('window.submitMultipleChoice(0)')
    
    console.log('Rendered HTML:', result)
  })

  it('should handle true-false questions', () => {
    Handlebars.registerHelper('eq', function(a, b, options) {
      console.log(`eq helper: comparing '${a}' === '${b}' => ${a === b}`)
      // @ts-ignore
      return a === b ? options.fn(this) : options.inverse(this)
    })

    const template = `
{{#if (eq type "true-false")}}
<p>True-false question: {{text}}</p>
<p>Correct answer: {{correct_answer}}</p>
{{else}}
<p>Not a true-false question. Type is: {{type}}</p>
{{/if}}
`

    const compiledTemplate = Handlebars.compile(template)
    
    const data = {
      type: "true-false",
      text: "The Earth is flat.",
      correct_answer: "false"
    }

    const result = compiledTemplate(data)
    console.log('True-false result:', result)
    
    expect(result).toContain('True-false question: The Earth is flat.')
    expect(result).toContain('Correct answer: false')
  })

  it('should check what happens with empty knowledge check', () => {
    const template = `
has_knowledge_check: {{has_knowledge_check}}
{{#if has_knowledge_check}}
<div>KC present</div>
{{else}}
<div>No KC</div>
{{/if}}
`
    const compiledTemplate = Handlebars.compile(template)
    
    // Test with false
    const result1 = compiledTemplate({ has_knowledge_check: false })
    expect(result1).toContain('has_knowledge_check: false')
    expect(result1).toContain('No KC')
    
    // Test with empty array
    const result2 = compiledTemplate({ 
      has_knowledge_check: true,
      knowledge_check_questions: []
    })
    expect(result2).toContain('has_knowledge_check: true')
    expect(result2).toContain('KC present')
  })
})