Feature: Open link in a new tab

  Scenario: Click a link and verify new tab opens
    Given the user navigates to "https://the-internet.herokuapp.com/windows"
    When the user captures the page snapshot
    And the user clicks on the "Click Here" link
    Then the user switches to the new tab
    And the user should see "New Window" text
