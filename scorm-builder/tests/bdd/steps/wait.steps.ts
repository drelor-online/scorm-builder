import { When, Then } from '@cucumber/cucumber'

// Wait for a specific number of seconds
When('I wait for {int} seconds', async function (seconds: number) {
  await this.page.waitForTimeout(seconds * 1000)
})

// Use When for waiting - removed duplicate Then

// Wait for a specific number of milliseconds
When('I wait for {int}ms', async function (milliseconds: number) {
  await this.page.waitForTimeout(milliseconds)
})

Then('I wait for {int}ms', async function (milliseconds: number) {
  await this.page.waitForTimeout(milliseconds)
})