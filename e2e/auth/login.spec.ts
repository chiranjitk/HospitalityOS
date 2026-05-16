import { test, expect, CREDENTIALS } from '../fixtures/auth.fixture';

// ─── Page Object Helpers ─────────────────────────────────────────────

/** Selectors used throughout the tests */
const sel = {
  emailInput: '#email',
  passwordInput: '#password',
  signInButton: 'button[type="submit"]',
  quickAdminLoginButton: 'button:has-text("Quick Admin Login")',
  passwordToggle: 'button[aria-label="Show password"], button[aria-label="Hide password"]',
  rememberMeCheckbox: '#remember',
  errorAlert: '[data-slot="alert"], [role="alert"][class*="destructive"]',
  demoCard: (role: string) => `button:has-text("${role}"):not(:has-text("Quick"))`,
  forgotPasswordLink: 'button:has-text("Forgot password")',
  loadingSpinner: '.animate-spin',
  demoModeBadge: 'text=Demo Mode',
};

/**
 * Fill and submit the login form.
 * If credentials are not provided, submits with empty fields (triggers HTML5 validation).
 */
async function fillAndSubmitLogin(
  page: import('@playwright/test').Page,
  email: string = '',
  password: string = '',
) {
  if (email) {
    await page.locator(sel.emailInput).fill(email);
  }
  if (password) {
    await page.locator(sel.passwordInput).fill(password);
  }
  await page.locator(sel.signInButton).click();
}

/**
 * Perform a full login flow: navigate, fill, submit, wait for redirect.
 * Returns true if the redirect to / was observed within the timeout.
 */
async function performFullLogin(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<boolean> {
  await fillAndSubmitLogin(page, email, password);

  try {
    await page.waitForURL('**/', { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────

test.describe('Login Page — StaySuite HospitalityOS', () => {
  // ── Global setup / teardown ────────────────────────────────────

  test.beforeEach(async ({ page }) => {
    // Clear cookies and storage before each test for full isolation
    await page.context().clearCookies();
    await page.goto('/login', { waitUntil: 'networkidle' });
    // Wait for the auth loading state to resolve so the form is visible
    await page.waitForTimeout(1000);
  });

  // ─────────────────────────────────────────────────────────────────
  // 1. Login page renders correctly
  // ─────────────────────────────────────────────────────────────────
  test('should render the login form with all expected elements', async ({ page }) => {
    // Brand header visible
    await expect(page.getByRole('heading', { name: /staysuite/i })).toBeVisible();

    // Form heading contains "Sign In"
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    // Email input
    const emailInput = page.locator(sel.emailInput);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toBeEnabled();

    // Password input
    const passwordInput = page.locator(sel.passwordInput);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toBeEnabled();

    // Sign In button
    const signInBtn = page.locator(sel.signInButton);
    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toBeEnabled();
    await expect(signInBtn).toContainText(/sign in/i);

    // Remember me checkbox
    await expect(page.locator(sel.rememberMeCheckbox)).toBeVisible();

    // Forgot password link
    await expect(page.locator(sel.forgotPasswordLink)).toBeVisible();

    // Quick Admin Login button (dev mode)
    await expect(page.locator(sel.quickAdminLoginButton)).toBeVisible();

    // Demo credential cards (dev mode) — Admin, Front Desk, Housekeeping
    await expect(page.locator(sel.demoCard('Admin'))).toBeVisible();
    await expect(page.locator(sel.demoCard('Front Desk'))).toBeVisible();
    await expect(page.locator(sel.demoCard('Housekeeping'))).toBeVisible();

    // Demo Mode badge
    await expect(page.getByText('Demo Mode')).toBeVisible();

    // Password visibility toggle (icon button with aria-label)
    const toggleBtn = page.locator('button[aria-label="Show password"]');
    await expect(toggleBtn).toBeVisible();

    // No error alert on initial render
    const errorAlert = page.locator(sel.errorAlert);
    await expect(errorAlert).not.toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. Successful login with admin credentials
  // ─────────────────────────────────────────────────────────────────
  test('should login successfully with admin credentials and redirect to /', async ({ page }) => {
    const { email, password } = CREDENTIALS.admin;

    // Fill and submit
    await fillAndSubmitLogin(page, email, password);

    // Wait for redirect away from /login
    await page.waitForURL((url) => !url.pathname.includes('login'), {
      timeout: 15000,
    });

    // Should land on the dashboard
    expect(page.url()).toContain('localhost:3000');

    // Session cookie should be set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.value).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. Successful login with frontdesk credentials
  // ─────────────────────────────────────────────────────────────────
  test('should login successfully with frontdesk credentials and redirect to /', async ({ page }) => {
    const { email, password } = CREDENTIALS.frontdesk;

    await fillAndSubmitLogin(page, email, password);

    await page.waitForURL((url) => !url.pathname.includes('login'), {
      timeout: 15000,
    });

    expect(page.url()).toContain('localhost:3000');

    // Session cookie should be set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.value).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────
  // 4. Failed login with wrong credentials
  // ─────────────────────────────────────────────────────────────────
  test('should show error alert when credentials are invalid', async ({ page }) => {
    // Use a non-existent email with a wrong password
    await fillAndSubmitLogin(page, 'nobody@royalstay.in', 'wrongpassword');

    // Error alert should appear
    const errorAlert = page.locator(sel.errorAlert);
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // Error message should mention invalid credentials
    await expect(errorAlert).toContainText(/invalid|email or password|error/i);

    // Should still be on the login page
    expect(page.url()).toContain('login');

    // Sign In button should be re-enabled (loading state cleared)
    await expect(page.locator(sel.signInButton)).toBeEnabled();
  });

  // ─────────────────────────────────────────────────────────────────
  // 5. Failed login with empty fields (HTML5 validation)
  // ─────────────────────────────────────────────────────────────────
  test('should trigger HTML5 validation when fields are empty', async ({ page }) => {
    // Both inputs have the `required` attribute — clicking submit without
    // filling them triggers native browser validation, not a network request.
    await page.locator(sel.signInButton).click();

    // Email input should show browser validation error (invalid state)
    const emailInput = page.locator(sel.emailInput);
    const isEmailInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(isEmailInvalid).toBe(true);

    // Password input should also be invalid
    const passwordInput = page.locator(sel.passwordInput);
    const isPasswordInvalid = await passwordInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(isPasswordInvalid).toBe(true);

    // No server-side error alert should appear
    const errorAlert = page.locator(sel.errorAlert);
    await expect(errorAlert).not.toBeVisible();

    // Should remain on the login page
    expect(page.url()).toContain('login');
  });

  // ─────────────────────────────────────────────────────────────────
  // 6. Password visibility toggle
  // ─────────────────────────────────────────────────────────────────
  test('should toggle password visibility when clicking the eye icon', async ({ page }) => {
    const passwordInput = page.locator(sel.passwordInput);

    // Initially type should be "password" (masked)
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the Show Password toggle
    const showBtn = page.locator('button[aria-label="Show password"]');
    await showBtn.click();

    // Type should switch to "text" (visible)
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // The "Hide password" button should now be rendered
    const hideBtn = page.locator('button[aria-label="Hide password"]');
    await expect(hideBtn).toBeVisible();

    // Click again to hide
    await hideBtn.click();

    // Type should be back to "password"
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // The "Show password" button should be rendered again
    await expect(showBtn).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // 7. Remember me checkbox
  // ─────────────────────────────────────────────────────────────────
  test('should toggle the remember me checkbox', async ({ page }) => {
    const checkbox = page.locator(sel.rememberMeCheckbox);

    // Initially unchecked
    await expect(checkbox).not.toBeChecked();

    // Click the associated label to toggle
    await page.getByLabel('Remember me', { exact: false }).click();

    // Should now be checked
    await expect(checkbox).toBeChecked();

    // Click again to uncheck
    await page.getByLabel('Remember me', { exact: false }).click();

    // Should be unchecked again
    await expect(checkbox).not.toBeChecked();
  });

  // ─────────────────────────────────────────────────────────────────
  // 8. Logout flow
  // ─────────────────────────────────────────────────────────────────
  test('should redirect to /login after logout', async ({ page }) => {
    // Step 1: Login as admin
    const { email, password } = CREDENTIALS.admin;
    await fillAndSubmitLogin(page, email, password);

    // Wait for redirect to main page
    await page.waitForURL((url) => !url.pathname.includes('login'), {
      timeout: 15000,
    });
    expect(page.url()).toContain('localhost:3000');

    // Wait for the app to fully hydrate (sidebar, header)
    await page.waitForTimeout(2000);

    // Step 2: Open the user dropdown menu
    // The user avatar / name button triggers the dropdown
    const userMenuTrigger = page.locator('button').filter({
      has: page.locator('[class*="avatar"], [class*="rounded-full"]'),
    }).first();

    // Alternative: look for the header user button area
    const headerAvatar = page.locator('header button').first();
    const clicked = await userMenuTrigger.count() > 0;
    if (clicked) {
      await userMenuTrigger.click();
    } else {
      // Fallback: try any button in the header area
      await headerAvatar.click();
    }

    // Wait for dropdown to open
    await page.waitForTimeout(500);

    // Step 3: Click the "Sign Out" / "Log Out" option
    const logoutOption = page.locator(
      '[role="menuitem"]:has-text("Log out"), [role="menuitem"]:has-text("Sign out"), [role="menuitem"]:has-text("Logout")',
    );
    await logoutOption.first().click();

    // Step 4: Verify redirect to /login
    await page.waitForURL('**/login', { timeout: 15000 });
    expect(page.url()).toContain('login');

    // Step 5: Verify session cookie is cleared
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────────
  // 9. Already authenticated redirect
  // ─────────────────────────────────────────────────────────────────
  test('should redirect to / when navigating to /login while already authenticated', async ({ page }) => {
    // Step 1: Login as admin
    const { email, password } = CREDENTIALS.admin;
    await fillAndSubmitLogin(page, email, password);

    await page.waitForURL((url) => !url.pathname.includes('login'), {
      timeout: 15000,
    });
    expect(page.url()).toContain('localhost:3000');

    // Wait for full page load
    await page.waitForTimeout(2000);

    // Step 2: Navigate to /login while still authenticated
    await page.goto('/login', { waitUntil: 'networkidle' });

    // Step 3: Should be redirected back to /
    await page.waitForURL('**/', { timeout: 15000 });
    expect(page.url()).toContain('localhost:3000');
    // Should NOT be on the login page
    expect(page.url()).not.toContain('login');
  });

  // ─────────────────────────────────────────────────────────────────
  // 10. Network error handling
  // ─────────────────────────────────────────────────────────────────
  test('should display an error when the login API is unreachable', async ({ page }) => {
    // Intercept the login API call and make it fail without a response
    // (simulates a network error / server unreachable)
    await page.route('**/api/auth/login', async (route) => {
      await route.abort('connectionrefused');
    });

    // Fill the form with valid-looking credentials
    const { email, password } = CREDENTIALS.admin;
    await fillAndSubmitLogin(page, email, password);

    // The page should handle the error gracefully.
    // AuthContext catches the fetch error and sets an error message.
    // The login page's handleSubmit catch block sets: "An error occurred. Please try again."
    const errorAlert = page.locator(sel.errorAlert);

    // The error might be shown in a UI alert or via toast.
    // We accept either: an [role="alert"] in the form, or a toast notification.
    try {
      await expect(errorAlert).toBeVisible({ timeout: 10000 });
      await expect(errorAlert).toContainText(/error|try again|failed/i);
    } catch {
      // Fallback: check for a toast notification
      const toast = page.locator(
        '[data-sonner-toast], [role="status"], [data-state="open"]',
      ).first();
      await expect(toast).toBeVisible({ timeout: 5000 });
      await expect(toast).toContainText(/error|try again|failed/i);
    }

    // Should still be on the login page
    expect(page.url()).toContain('login');

    // Sign In button should be re-enabled
    await expect(page.locator(sel.signInButton)).toBeEnabled();
  });

  // ─────────────────────────────────────────────────────────────────
  // Bonus: Demo credential cards auto-fill
  // ─────────────────────────────────────────────────────────────────
  test('should auto-fill credentials when clicking a demo credential card', async ({ page }) => {
    // Click the "Admin" demo card
    await page.locator(sel.demoCard('Admin')).click();

    // Email input should be populated
    const emailInput = page.locator(sel.emailInput);
    await expect(emailInput).toHaveValue(CREDENTIALS.admin.email);

    // Password input should be populated
    const passwordInput = page.locator(sel.passwordInput);
    await expect(passwordInput).toHaveValue(CREDENTIALS.admin.password);

    // Click the "Front Desk" demo card — values should change
    await page.locator(sel.demoCard('Front Desk')).click();
    await expect(emailInput).toHaveValue(CREDENTIALS.frontdesk.email);
    await expect(passwordInput).toHaveValue(CREDENTIALS.frontdesk.password);

    // Click the "Housekeeping" demo card
    await page.locator(sel.demoCard('Housekeeping')).click();
    await expect(emailInput).toHaveValue(CREDENTIALS.housekeeping.email);
    await expect(passwordInput).toHaveValue(CREDENTIALS.housekeeping.password);
  });

  // ─────────────────────────────────────────────────────────────────
  // Bonus: Quick Admin Login
  // ─────────────────────────────────────────────────────────────────
  test('should login as admin via the Quick Admin Login button', async ({ page }) => {
    await page.locator(sel.quickAdminLoginButton).click();

    // Should redirect away from /login
    await page.waitForURL((url) => !url.pathname.includes('login'), {
      timeout: 15000,
    });

    expect(page.url()).toContain('localhost:3000');

    // Session cookie should be set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.value).toBeTruthy();
  });
});
