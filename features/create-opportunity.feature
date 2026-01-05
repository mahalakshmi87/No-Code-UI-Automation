Feature: Create New Opportunity with Transportation Record Type

  Background:
    Given the user is on the Salesforce login page

  Scenario: User logs in and creates a new opportunity with Transportation record type
    # Authentication
    When the user enters username "apiuserplaywright@onelineage.com.sit"
    And the user enters password "Lineage@789"
    And the user clicks on "Log in to Sandbox" button
    And the user waits for the dashboard to load
    Then the user should see the Salesforce home page

    # Navigate to Account
    When the user clicks on the "Accounts" tab
    And the user navigates to the account URL "https://lineage--sit.sandbox.lightning.force.com/lightning/r/Account/0010c00001vlGl5AAE/view"
    And the user waits for the account page to load
    Then the user should see the account details displayed

    # Prepare and open New Opportunity
    When the user waits for 30 seconds
    And the user maximizes the browser window
    And the user clicks on "New Opportunity" button from the top right corner
    And the user waits for the New Opportunity dialog to appear
    Then the New Opportunity record type selection modal should be visible

    # Select Transportation Record Type
    When the user clicks on the radio button left to the "Transportation"
    And the user waits for 30 seconds
    Then the "Transportation" record type option should be selected

  Scenario: Verify all record type options are available
    Given the user is on the Salesforce login page
    When the user enters username "apiuserplaywright@onelineage.com.sit"
    And the user enters password "Lineage@789"
    And the user clicks on "Log in to Sandbox" button
    And the user waits for the dashboard to load
    And the user navigates to the account URL "https://lineage--sit.sandbox.lightning.force.com/lightning/r/Account/0010c00001vlGl5AAE/view"
    And the user waits for the account page to load
    And the user clicks on "New Opportunity" button from the top right corner
    And the user waits for the New Opportunity dialog to appear
    Then the user should see all available record types:
      | Record Type           | Description                                                 |
      | Warehouse             | To be used when selling warehousing services                |
      | Cost Savings          | To be used for cost savings                                 |
      | D2C                   | To be used when selling direct-to-consumer services         |
      | Freight Forwarding    | To be used when selling freight forwarding services         |
      | Manufacturing         | To be used when selling manufacturing services              |
      | Rail Solutions        | To be used when selling Lineage rail transportation services|
      | Redistribution        | To be used when selling redistribution services             |
      | Transportation        | To be used when selling transportation services             |
