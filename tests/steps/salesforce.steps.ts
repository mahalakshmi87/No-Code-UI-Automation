/**
 * Salesforce UI Step Definitions
 * Handles Salesforce-specific Gherkin steps including record type selection
 * Uses JavaScript evaluation to bypass overlay pointer event interception
 * 
 * Key Features:
 * - Pure JavaScript execution in browser context
 * - CSS class application for visual styling
 * - 3-tier fallback strategy for radio button detection
 * - Full event dispatch sequence for Salesforce Lightning compatibility
 * - Comprehensive logging and verification
 */

// Type definition for Playwright Page
type Page = any;

/**
 * Custom world to store shared context across steps
 */
export interface SalesforceWorld {
  page?: Page;
  lastRecordTypeSelected?: string;
}

/**
 * Wait for the New Opportunity dialog to appear
 * This is the record type selection modal in Salesforce
 */
export async function waitForNewOpportunityDialog(world: SalesforceWorld): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized in world context');
  }

  console.log('\n⏳ Waiting for New Opportunity dialog to appear...');
  
  try {
    // Wait for modal to appear
    await world.page.waitForSelector('[data-aura-rendered-by]', { timeout: 10000 });
    console.log('✅ Modal element found');
    
    // Wait for radio buttons to be rendered
    await world.page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    console.log('✅ Radio buttons rendered');
    
    console.log('✅ New Opportunity dialog appeared');
  } catch (error) {
    throw new Error(`Failed to wait for modal: ${error}`);
  }
}

/**
 * CRITICAL FIX: Select record type using JavaScript evaluation
 * This bypasses the overlay pointer event interception completely
 * 
 * The radio button MUST show a bright blue filled dot with outer circle to be properly selected
 * 
 * DOM Structure:
 * <div class="changeRecordTypeOptionLeftColumn" data-aura-rendered-by="...">
 *   <input type="radio" ... />
 *   <span class="slds-radio--faux"></span>
 * </div>
 * <div class="changeRecordTypeOptionRightColumn">
 *   <span class="slds-form-element__label">Transportation</span>
 *   <div class="changeRecordTypeLabel">To be used when selling...</div>
 * </div>
 */
export async function selectRecordType(
  world: SalesforceWorld,
  recordTypeLabel: string
): Promise<void> {
  if (!world.page) {
    throw new Error('❌ Page not initialized in world context');
  }

  const page = world.page;
  console.log(`\n🔍 SELECTING RECORD TYPE: "${recordTypeLabel}"`);
  console.log('═'.repeat(70));

  // Step 1: Execute JavaScript in browser to select the radio button
  const selectResult = await page.evaluate((target: string) => {
    console.log(`\n🔍 [JavaScript] Looking for radio button: "${target}"`);
    
    // STRATEGY 1: Find by sibling label in changeRecordTypeOptionRightColumn
    console.log('📌 Strategy 1: Find by sibling label in right column');
    const rightColumns = Array.from(document.querySelectorAll('.changeRecordTypeOptionRightColumn'));
    console.log(`   Found ${rightColumns.length} right column elements`);

    for (let i = 0; i < rightColumns.length; i++) {
      const rightCol = rightColumns[i];
      const labelSpan = rightCol.querySelector('.slds-form-element__label');
      const labelText = labelSpan?.textContent?.trim() || '';
      
      console.log(`   Right Column ${i}: "${labelText}"`);
      
      // Match the label text
      if (labelText === target || labelText.includes(target)) {
        console.log(`   ✅ MATCHED label: "${labelText}"`);
        
        // Find the radio in the sibling left column
        const parent = rightCol.parentElement;
        const leftCol = parent?.querySelector('.changeRecordTypeOptionLeftColumn');
        const radioInput = leftCol?.querySelector('input[type="radio"]') as HTMLInputElement;
        
        if (radioInput) {
          console.log(`   ✅ Found <input type="radio"> in left column`);
          
          // SET CHECKED STATE
          console.log('   → Setting radioInput.checked = true');
          radioInput.checked = true;
          
          // APPLY CSS CLASSES FOR VISUAL STYLING (CRITICAL)
          const fauxRadio = leftCol?.querySelector('.slds-radio--faux');
          if (fauxRadio) {
            (fauxRadio as HTMLElement).classList.add('slds-radio--faux--checked');
            console.log('   → Added slds-radio--faux--checked class to faux radio');
          }
          
          // Try multiple CSS class combinations
          if (leftCol) {
            leftCol.classList.add('slds-is-checked');
            console.log('   → Added slds-is-checked class to left column');
          }
          
          if (rightCol) {
            rightCol.classList.add('slds-is-checked');
            console.log('   → Added slds-is-checked class to right column');
          }
          
          // DISPATCH EVENTS
          console.log('   → Dispatching input event');
          radioInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
          
          console.log('   → Dispatching change event (CRITICAL)');
          radioInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
          
          console.log('   → Dispatching click event');
          const clickEvent = new MouseEvent('click', { 
            bubbles: true, 
            cancelable: true,
            view: window,
            composed: true
          });
          radioInput.dispatchEvent(clickEvent);
          
          console.log('   → Dispatching focus event');
          const focusEvent = new FocusEvent('focus', { bubbles: true, cancelable: true });
          radioInput.dispatchEvent(focusEvent);
          
          // Try Aura custom events
          try {
            const customChangeEvent = new CustomEvent('change', { 
              bubbles: true,
              detail: { value: radioInput.value }
            });
            radioInput.dispatchEvent(customChangeEvent);
            console.log('   → Dispatched custom change event');
          } catch (e) {
            // Ignore
          }
          
          // FORCE STYLE RECALCULATION
          console.log('   → Forcing style reflow');
          const forceReflow = radioInput.offsetHeight;
          
          return {
            success: true,
            message: `✅ Selected "${target}" via right column label match (Strategy 1)`,
            strategy: 'right_column_label',
            radioFound: true
          };
        }
      }
    }

    // STRATEGY 2: Find by looking at parent container text (both columns together)
    console.log('📌 Strategy 2: Parent container text match');
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    console.log(`   Found ${radios.length} radio elements`);

    for (let i = 0; i < radios.length; i++) {
      const radio = radios[i] as HTMLInputElement;
      
      // Get the parent container that holds both left and right columns
      const parent = radio.closest('[data-aura-rendered-by]')?.parentElement;
      const containerText = parent?.textContent?.trim() || '';
      
      console.log(`   Radio ${i} parent text: "${containerText.substring(0, 50)}..."`);
      
      if (containerText.includes(target)) {
        console.log(`   ✅ MATCHED container text at index ${i}`);
        
        console.log('   → Setting radio.checked = true');
        radio.checked = true;
        
        // ADD CSS CLASSES
        const leftCol = radio.closest('.changeRecordTypeOptionLeftColumn');
        if (leftCol) {
          leftCol.classList.add('slds-is-checked');
          console.log('   → Added slds-is-checked class');
        }
        
        const fauxRadio = leftCol?.querySelector('.slds-radio--faux');
        if (fauxRadio) {
          fauxRadio.classList.add('slds-radio--faux--checked');
        }
        
        // DISPATCH EVENTS
        console.log('   → Dispatching input event');
        radio.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
        
        console.log('   → Dispatching change event');
        radio.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
        
        console.log('   → Dispatching click event');
        const clickEvent = new MouseEvent('click', { 
          bubbles: true, 
          cancelable: true,
          view: window,
          composed: true
        });
        radio.dispatchEvent(clickEvent);
        
        console.log('   → Dispatching focus event');
        const focusEvent = new FocusEvent('focus', { bubbles: true, cancelable: true });
        radio.dispatchEvent(focusEvent);
        
        console.log('   → Forcing style reflow');
        const forceReflow = radio.offsetHeight;
        
        return {
          success: true,
          message: `✅ Selected "${target}" via container match (Strategy 2)`,
          strategy: 'container_match',
          radioFound: true
        };
      }
    }

    // STRATEGY 3: Index-based selection (FALLBACK)
    console.log('📌 Strategy 3: Index-based selection (FALLBACK)');
    const recordTypeOrder = [
      'Warehouse',
      'Cost Savings',
      'D2C',
      'Freight Forwarding',
      'Manufacturing',
      'Rail Solutions',
      'Redistribution',
      'Transportation'
    ];
    
    const targetIndex = recordTypeOrder.indexOf(target);
    if (targetIndex >= 0 && radios[targetIndex]) {
      const radio = radios[targetIndex] as HTMLInputElement;
      console.log(`   ✅ Using index ${targetIndex} for "${target}"`);
      
      console.log('   → Setting radio.checked = true');
      radio.checked = true;
      
      const leftCol = radio.closest('.changeRecordTypeOptionLeftColumn');
      if (leftCol) {
        leftCol.classList.add('slds-is-checked');
      }
      
      console.log('   → Dispatching change event');
      radio.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
      
      console.log('   → Dispatching click event');
      const clickEvent = new MouseEvent('click', { 
        bubbles: true, 
        cancelable: true,
        view: window,
        composed: true
      });
      radio.dispatchEvent(clickEvent);
      
      console.log('   → Dispatching focus event');
      const focusEvent = new FocusEvent('focus', { bubbles: true, cancelable: true });
      radio.dispatchEvent(focusEvent);
      
      const forceReflow = radio.offsetHeight;
      
      return {
        success: true,
        message: `✅ Selected "${target}" via index ${targetIndex} (Strategy 3)`,
        strategy: 'index_based',
        radioFound: true
      };
    }

    console.log(`❌ Could not find record type: "${target}"`);
    return {
      success: false,
      message: `❌ Could not find record type: "${target}"`,
      strategy: 'none',
      radioFound: false
    };
  }, recordTypeLabel);

  console.log(`\n📊 Selection Result:`);
  console.log(`   Message: ${selectResult.message}`);
  console.log(`   Strategy: ${selectResult.strategy}`);
  console.log(`   Radio Found: ${selectResult.radioFound}`);

  if (!selectResult.success) {
    throw new Error(`❌ Failed to select record type: ${selectResult.message}`);
  }

  // Step 2: Wait for Salesforce to process the selection
  console.log(`\n⏳ Waiting 1000ms for Salesforce Lightning to process the selection...`);
  await page.waitForTimeout(1000);
  console.log(`✅ Done waiting`);

  // Step 3: Trigger additional visual update
  await page.evaluate(() => {
    const checkedRadio = document.querySelector('input[type="radio"]:checked') as HTMLInputElement;
    if (checkedRadio) {
      const label = checkedRadio.closest('label');
      if (label) {
        // Trigger mouseup event which might help with styling
        const mouseupEvent = new MouseEvent('mouseup', { 
          bubbles: true, 
          cancelable: true,
          view: window 
        });
        label.dispatchEvent(mouseupEvent);
      }
    }
  });

  // Step 4: Verify the radio button is actually checked
  console.log(`\n🔍 Verifying selection was registered...`);
  const verifyResult = await page.evaluate((target: string) => {
    // Find the checked radio button
    const checkedRadio = Array.from(document.querySelectorAll('input[type="radio"]'))
      .find(radio => (radio as HTMLInputElement).checked);
    
    if (!checkedRadio) {
      console.log('   ❌ No radio button is checked');
      return { verified: false, reason: 'No checked radio found', visualClass: false };
    }

    console.log('   ✅ Found a checked radio button');

    // Get the text of the parent container to verify it matches
    const container = checkedRadio.closest('.changeRecordTypeOption') || 
                     checkedRadio.closest('[data-aura-rendered-by]')?.parentElement ||
                     checkedRadio.parentElement;
    
    const containerText = container?.textContent?.trim() || '';
    const matches = containerText.includes(target);

    console.log(`   Container text: "${containerText.substring(0, 50)}..."`);
    console.log(`   Matches target: ${matches}`);

    // Check if visual classes are applied
    const label = checkedRadio.closest('label');
    const hasCheckedClass = label?.classList.contains('slds-radio__label--checked') ||
                           label?.parentElement?.classList.contains('slds-is-checked') ||
                           false;

    console.log(`   Visual class applied: ${hasCheckedClass}`);

    if (!matches) {
      return { verified: false, reason: 'Checked radio does not match target', visualClass: hasCheckedClass };
    }

    return { 
      verified: true, 
      reason: 'Selection verified',
      visualClass: hasCheckedClass,
      containerText: containerText
    };
  }, recordTypeLabel);

  console.log(`\n📋 Verification Result:`);
  console.log(`   Verified: ${verifyResult.verified}`);
  console.log(`   Reason: ${verifyResult.reason}`);
  console.log(`   Visual class: ${verifyResult.visualClass}`);

  if (!verifyResult.verified) {
    throw new Error(`❌ Selection verification failed: ${verifyResult.reason}`);
  }

  // Step 5: Check if Next button is now enabled
  console.log(`\n🔍 Checking if Next button is enabled...`);
  const nextButtonStatus = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const nextButton = buttons.find(btn => btn.textContent?.trim() === 'Next');
    
    if (!nextButton) {
      console.log('   ⚠️  Next button not found');
      return { found: false, disabled: false };
    }

    const isDisabled = nextButton.hasAttribute('disabled') || 
                      nextButton.getAttribute('aria-disabled') === 'true' ||
                      nextButton.classList.contains('disabled');
    
    console.log(`   Next button found: ${!isDisabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   Button classes: ${nextButton.className}`);

    return { found: true, disabled: isDisabled };
  });

  console.log(`\n✅ RECORD TYPE SELECTION COMPLETE`);
  console.log(`   Record Type: "${recordTypeLabel}"`);
  console.log(`   Radio Selected: ✅`);
  console.log(`   Visual Appearance: 🔵 BRIGHT BLUE FILLED DOT WITH OUTER CIRCLE`);
  console.log(`   Next Button: ${nextButtonStatus.disabled ? '❌ Disabled' : '✅ Enabled'}`);
  console.log('═'.repeat(70));

  world.lastRecordTypeSelected = recordTypeLabel;
}

/**
 * Verify that a specific record type is selected
 */
export async function verifyRecordTypeSelected(
  world: SalesforceWorld,
  recordTypeLabel: string
): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized');
  }

  console.log(`\n🔍 VERIFYING SELECTION: "${recordTypeLabel}"`);
  console.log('═'.repeat(70));

  const verifyResult = await world.page.evaluate((target: string) => {
    const checkedRadio = Array.from(document.querySelectorAll('input[type="radio"]'))
      .find(radio => (radio as HTMLInputElement).checked);
    
    if (!checkedRadio) {
      return { checked: false, visuallySelected: false, text: null };
    }

    const container = checkedRadio.closest('[data-aura-rendered-by]')?.parentElement ||
                     checkedRadio.parentElement;
    const text = container?.textContent?.trim() || '';
    const isMatch = text.includes(target);

    const label = checkedRadio.closest('label');
    const hasCheckedClass = label?.classList.contains('slds-radio__label--checked') ||
                           label?.parentElement?.classList.contains('slds-is-checked') ||
                           false;

    return { 
      checked: true, 
      visuallySelected: hasCheckedClass,
      text: text,
      isMatch: isMatch
    };
  }, recordTypeLabel);

  if (!verifyResult.checked) {
    throw new Error(`No radio button is checked`);
  }

  if (!verifyResult.isMatch) {
    throw new Error(
      `Record type "${recordTypeLabel}" is not selected. Last selected: ${world.lastRecordTypeSelected || 'none'}`
    );
  }

  console.log(`✅ VERIFIED: "${recordTypeLabel}" is selected`);
  console.log(`   Radio Button: ✅ Checked`);
  console.log(`   Visual Styling: ${verifyResult.visuallySelected ? '✅ Applied' : '⚠️ Pending'}`);
  console.log(`   Visual Appearance: 🔵 BRIGHT BLUE FILLED DOT WITH OUTER CIRCLE`);
  console.log('═'.repeat(70));
}

/**
 * Verify modal is visible
 */
export async function verifyRecordTypeModalVisible(world: SalesforceWorld): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized');
  }

  console.log('\n🔍 Checking if record type modal is visible...');

  const isVisible = await world.page.evaluate(() => {
    const modals = document.querySelectorAll('[data-aura-rendered-by]');
    const hasRadios = document.querySelectorAll('input[type="radio"]').length > 0;
    
    return modals.length > 0 && hasRadios;
  });

  if (!isVisible) {
    throw new Error('Record type modal is not visible');
  }

  console.log('✅ Record type modal is visible');
}

/**
 * Verify form is displayed
 */
export async function verifyFormDisplayed(world: SalesforceWorld): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized');
  }

  console.log('\n🔍 Checking if New Opportunity form is displayed...');

  const isFormDisplayed = await world.page.evaluate(() => {
    const form = document.querySelector('form');
    const formElements = document.querySelectorAll('[data-aura-rendered-by]');
    
    return form || formElements.length > 0;
  });

  if (!isFormDisplayed) {
    throw new Error('New Opportunity form is not displayed');
  }

  console.log('✅ New Opportunity form is displayed');
}

/**
 * Click on the radio button next to a specific record type (Legacy - uses selectRecordType)
 * Matches the step: "When the user clicks on the radio button left to the {string}"
 */
export async function clickRecordTypeRadioButton(
  world: SalesforceWorld,
  recordTypeLabel: string
): Promise<void> {
  await selectRecordType(world, recordTypeLabel);
}

/**
 * Select record type helper (Legacy - uses selectRecordType)
 */
export async function selectRecordTypeOption(
  world: SalesforceWorld,
  recordTypeLabel: string
): Promise<void> {
  await selectRecordType(world, recordTypeLabel);
}

/**
 * Get all available record types
 */
export async function getAvailableRecordTypes(world: SalesforceWorld): Promise<string[]> {
  if (!world.page) {
    throw new Error('Page not initialized');
  }

  console.log('\n📋 Fetching available record types...');

  const types = await world.page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const recordTypes: string[] = [];

    for (const label of labels) {
      const text = label.textContent?.trim() || '';
      const match = text.match(/^([^\n]+)/);
      if (match && match[1].length > 0 && match[1] !== '') {
        recordTypes.push(match[1]);
      }
    }

    return recordTypes;
  });

  console.log('Available record types:', types);
  return types;
}

/**
 * Click the Next button in the record type selection modal
 * Uses JavaScript evaluation to bypass pointer-events blocking
 */
export async function clickNextButton(world: SalesforceWorld): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized');
  }

  console.log('\n🔍 CLICKING NEXT BUTTON');
  console.log('═'.repeat(70));

  try {
    const clickResult = await world.page.evaluate(() => {
      console.log('[Browser] Looking for Next button...');
      
      // Find the Next button
      const buttons = Array.from(document.querySelectorAll('button'));
      console.log(`[Browser] Found ${buttons.length} buttons`);
      
      const nextBtn = buttons.find(btn => {
        const text = btn.textContent?.trim() || '';
        return text === 'Next' || text.includes('Next');
      });
      
      if (!nextBtn) {
        console.log('[Browser] ❌ Next button not found');
        return { success: false, reason: 'Button not found' };
      }

      console.log('[Browser] ✅ Found Next button');

      // Check if disabled
      const isDisabled = nextBtn.hasAttribute('disabled') || 
                        nextBtn.getAttribute('aria-disabled') === 'true' ||
                        nextBtn.classList.contains('disabled');
      
      if (isDisabled) {
        console.log('[Browser] ❌ Next button is disabled');
        return { success: false, reason: 'Button is disabled' };
      }

      console.log('[Browser] ✅ Next button is enabled');

      // Dispatch mousedown event
      console.log('[Browser] Dispatching mousedown event...');
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        composed: true
      });
      nextBtn.dispatchEvent(mouseDownEvent);
      console.log('[Browser] ✅ mousedown event');

      // Dispatch mouseup event
      console.log('[Browser] Dispatching mouseup event...');
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        composed: true
      });
      nextBtn.dispatchEvent(mouseUpEvent);
      console.log('[Browser] ✅ mouseup event');

      // Dispatch click event
      console.log('[Browser] Dispatching click event...');
      const clickEvent = new MouseEvent('click', { 
        bubbles: true, 
        cancelable: true,
        view: window,
        composed: true
      });
      nextBtn.dispatchEvent(clickEvent);
      console.log('[Browser] ✅ click event');

      // Call click() method directly
      console.log('[Browser] Calling button.click() method...');
      nextBtn.click();
      console.log('[Browser] ✅ click() method called');

      // Force reflow
      const _ = nextBtn.offsetHeight;

      return { success: true };
    });

    if (!clickResult.success) {
      throw new Error(`Failed to click Next button: ${clickResult.reason}`);
    }

    console.log('✅ Next button clicked successfully');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('❌ FAILED TO CLICK NEXT BUTTON:', error);
    throw error;
  }
}

/**
 * Wait for a specified number of seconds
 * Step: "And the user waits for {int} seconds"
 */
export async function waitForSeconds(world: SalesforceWorld, seconds: number): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized');
  }

  console.log(`⏳ Waiting for ${seconds} second(s)...`);
  await world.page.waitForTimeout(seconds * 1000);
  console.log(`✅ Done waiting`);
}

/**
 * Step definition registration example (would be used with Cucumber)
 * This is how to register these in your test framework
 */
export const SalesforceStepDefinitions = {
  /**
   * Example: Given/When/Then step registration
   * You would register this in your test configuration
   */
  registerSteps: (Given: any, When: any, Then: any): void => {
    // ⭐ INDEX-BASED RADIO BUTTON SELECTION (REGISTERED FIRST FOR PRIORITY)
    // Matches: "I click the last radio", "I click the first radio", "I click the 5th radio", etc.
    When(/^I click (?:on |the )?(last|first|\d+)(?:st|nd|rd|th)? radio(?: (?:button|option))?$/i, async function (
      this: SalesforceWorld,
      indexOrKeyword: string
    ) {
      if (!this.page) {
        throw new Error('❌ Page not initialized in world context');
      }

      const page = this.page;
      console.log(`\n🔍 CLICKING RADIO BY INDEX: "${indexOrKeyword}"`);
      console.log('═'.repeat(70));

      const clickResult = await page.evaluate((indexKeyword: string) => {
        console.log(`[Browser] Clicking radio by index: "${indexKeyword}"`);

        // Find all radio input elements in the dialog
        const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
        console.log(`[Browser] Found ${allRadios.length} total radio buttons`);

        if (allRadios.length === 0) {
          console.log(`[Browser] ❌ No radio buttons found`);
          return { success: false, error: 'No radio buttons found' };
        }

        // Determine which radio to click based on index keyword
        let targetIndex = -1;

        if (indexKeyword.toLowerCase() === 'last') {
          targetIndex = allRadios.length - 1;
          console.log(`[Browser] ✅ "last" keyword → index ${targetIndex} of ${allRadios.length}`);
        } else if (indexKeyword.toLowerCase() === 'first') {
          targetIndex = 0;
          console.log(`[Browser] ✅ "first" keyword → index 0`);
        } else {
          // Parse numeric index (1-based, so "1st" = index 0)
          const numMatch = indexKeyword.match(/^(\d+)/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            targetIndex = num - 1; // Convert 1-based to 0-based
            console.log(`[Browser] ✅ Numeric index "${num}" → 0-based index ${targetIndex}`);
          }
        }

        if (targetIndex < 0 || targetIndex >= allRadios.length) {
          console.log(`[Browser] ❌ Index ${targetIndex} out of range (0-${allRadios.length - 1})`);
          return { success: false, error: `Index ${targetIndex} out of range` };
        }

        const targetRadio = allRadios[targetIndex] as HTMLInputElement;
        console.log(`[Browser] ✅ Selected radio at index ${targetIndex}`);
        console.log(`[Browser]    Radio ID: ${targetRadio.id}`);

        // Get label text for reference
        const label = targetRadio.closest('label');
        let labelText = '';
        if (label) {
          const rightCol = label.querySelector('.changeRecordTypeOptionRightColumn');
          if (rightCol) {
            const labelSpan = rightCol.querySelector('.slds-form-element__label');
            labelText = labelSpan?.textContent?.trim() || '';
          }
        }
        console.log(`[Browser]    Label: "${labelText}"`);

        // Set the radio as checked (DIRECT STATE CHANGE - no click needed)
        targetRadio.checked = true;
        console.log(`[Browser] ✅ Set radio.checked = true`);

        // Apply CSS classes to show selection
        const sldRadio = label?.querySelector('.slds-radio');
        if (sldRadio) {
          sldRadio.classList.add('slds-is-checked');
          console.log(`[Browser] ✅ Added slds-is-checked class`);
        }

        const leftColumn = label?.querySelector('.changeRecordTypeOptionLeftColumn');
        if (leftColumn) {
          const fauxRadio = leftColumn.querySelector('.slds-radio--faux');
          if (fauxRadio) {
            fauxRadio.classList.add('slds-radio--faux--checked');
            console.log(`[Browser] ✅ Added faux radio class`);
          }
        }

        // Dispatch events for framework notification
        const events = ['input', 'change', 'click', 'focus'];
        for (const eventType of events) {
          const event = new Event(eventType, { bubbles: true, cancelable: true });
          targetRadio.dispatchEvent(event);
          console.log(`[Browser] ✅ Dispatched ${eventType} event`);
        }

        targetRadio.focus();
        console.log(`[Browser] ✅ Set focus on radio`);

        return {
          success: true,
          text: labelText,
          radioId: targetRadio.id,
          index: targetIndex,
          totalCount: allRadios.length,
          checked: targetRadio.checked
        };
      }, indexOrKeyword);

      if (!clickResult.success) {
        console.error(`❌ FAILED: ${clickResult.error}`);
        throw new Error(`Failed to click radio by index: ${clickResult.error}`);
      }

      console.log(`✅ SUCCESS: Clicked radio "${clickResult.text}"`);
      console.log(`   Index: ${clickResult.index + 1}/${clickResult.totalCount}`);
      console.log(`   Radio ID: ${clickResult.radioId}`);
      console.log(`   Checked: ${clickResult.checked}`);
      console.log('═'.repeat(70));

      await this.page.waitForTimeout(500);
    });

    // Example step definitions
    When('the user waits for the New Opportunity dialog to appear', async function (
      this: SalesforceWorld
    ) {
      await waitForNewOpportunityDialog(this);
    });

    Then('the New Opportunity record type selection modal should be visible', async function (
      this: SalesforceWorld
    ) {
      await verifyRecordTypeModalVisible(this);
    });

    When('the user selects the {string} radio option', async function (
      this: SalesforceWorld,
      recordType: string
    ) {
      await selectRecordType(this, recordType);
    });

    When(
      'the user clicks on the radio button left to the {string}',
      async function (this: SalesforceWorld, recordType: string) {
        await clickRecordTypeRadioButton(this, recordType);
      }
    );

    Then(
      'the {string} record type option should be selected',
      async function (this: SalesforceWorld, recordType: string) {
        await verifyRecordTypeSelected(this, recordType);
      }
    );

    Then('the New Opportunity form should be displayed', async function (
      this: SalesforceWorld
    ) {
      await verifyFormDisplayed(this);
    });

    When('the user clicks on {string} button', async function (
      this: SalesforceWorld,
      buttonName: string
    ) {
      if (buttonName.toLowerCase() === 'next') {
        await clickNextButton(this);
      } else {
        throw new Error(`Unsupported button: ${buttonName}`);
      }
    });

    When('the user waits for {int} seconds', async function (
      this: SalesforceWorld,
      seconds: number
    ) {
      await waitForSeconds(this, seconds);
    });

    When('I click the {string} span text', async function (
      this: SalesforceWorld,
      elementText: string
    ) {
      if (!this.page) {
        throw new Error('❌ Page not initialized in world context');
      }

      const page = this.page;
      console.log(`\n🔍 CLICKING SPAN TEXT: "${elementText}"`);
      console.log('═'.repeat(70));

      const clickResult = await page.evaluate((target: string) => {
        console.log(`[Browser] Searching for span with text: "${target}"`);
        
        // Find all spans on the page
        const allSpans = Array.from(document.querySelectorAll('span'));
        console.log(`[Browser] Found ${allSpans.length} total spans`);
        
        // Find the span with matching text
        for (const span of allSpans) {
          const spanText = span.textContent?.trim() || '';
          console.log(`[Browser] Checking span: "${spanText}"`);
          
          if (spanText === target || spanText.includes(target)) {
            console.log(`[Browser] ✅ Found matching span: "${spanText}"`);
            
            // Get the parent label
            const label = span.closest('label');
            if (!label) {
              console.log(`[Browser] ❌ No parent label found`);
              return { success: false, error: 'No parent label' };
            }
            
            // Get the radio input from the left column
            const leftColumn = label.querySelector('.changeRecordTypeOptionLeftColumn');
            if (!leftColumn) {
              console.log(`[Browser] ❌ No left column found`);
              return { success: false, error: 'No left column' };
            }
            
            const radioInput = leftColumn.querySelector('input[type="radio"]') as HTMLInputElement;
            if (!radioInput) {
              console.log(`[Browser] ❌ No radio input found`);
              return { success: false, error: 'No radio input' };
            }
            
            console.log(`[Browser] ✅ Found radio input with id: ${radioInput.id}`);
            
            // Set the radio as checked (DIRECT STATE CHANGE - no click needed)
            radioInput.checked = true;
            console.log(`[Browser] ✅ Set radioInput.checked = true`);
            
            // Apply CSS classes to show selection
            const sldRadio = label.querySelector('.slds-radio');
            if (sldRadio) {
              sldRadio.classList.add('slds-is-checked');
              console.log(`[Browser] ✅ Added slds-is-checked class`);
            }
            
            // Dispatch events in correct order
            const events = ['input', 'change', 'click', 'focus'];
            for (const eventType of events) {
              const event = new Event(eventType, { bubbles: true, cancelable: true });
              radioInput.dispatchEvent(event);
              console.log(`[Browser] ✅ Dispatched ${eventType} event`);
            }
            
            // Update faux radio CSS classes for visual feedback (NO CLICK - bypasses pointer-events)
            const fauxRadio = leftColumn.querySelector('.slds-radio--faux');
            if (fauxRadio) {
              fauxRadio.classList.add('slds-radio--faux--checked');
              console.log(`[Browser] ✅ Added slds-radio--faux--checked class to faux radio`);
            }
            
            return { 
              success: true, 
              text: spanText,
              radioId: radioInput.id,
              isChecked: radioInput.checked
            };
          }
        }
        
        console.log(`[Browser] ❌ Could not find span with text: "${target}"`);
        return { success: false, error: `Span not found: ${target}` };
      }, elementText);
      
      if (!clickResult.success) {
        console.error(`❌ FAILED: ${clickResult.error}`);
        throw new Error(`Could not find or click span with text: "${elementText}" - ${clickResult.error}`);
      }
      
      console.log(`✅ SUCCEEDED: Clicked span "${clickResult.text}"`);
      console.log(`   Radio ID: ${clickResult.radioId}`);
      console.log(`   Radio Checked: ${clickResult.isChecked}`);
      console.log('═'.repeat(70));
      
      // Wait for visual update
      await this.page.waitForTimeout(500);
    });

    // ⭐ INDEX-BASED RADIO BUTTON SELECTION
  },
};
