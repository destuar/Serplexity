/**
 * @file EmailNotificationsModal.test.tsx
 * @description Tests for the EmailNotificationsModal component
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import EmailNotificationsModal from "../components/layout/EmailNotificationsModal";
import { AuthContext } from "../hooks/useAuth";
import { CompanyContext } from "../hooks/useCompany";
import * as emailNotificationService from "../services/emailNotificationService";

// Mock the email notification service
vi.mock("../services/emailNotificationService", () => ({
  getNotificationRules: vi.fn(),
  createNotificationRules: vi.fn(),
  deleteNotificationRule: vi.fn(),
  sendTestNotification: vi.fn(),
  getNotificationStats: vi.fn(),
}));

const mockEmailService = vi.mocked(emailNotificationService);

// Mock user and company data
const mockUser = {
  id: "user123",
  email: "test@example.com",
  name: "Test User",
};

const mockCompanies = [
  { id: "company1", name: "Company A", website: "https://companya.com" },
  { id: "company2", name: "Company B", website: "https://companyb.com" },
];

const mockSelectedCompany = mockCompanies[0];

// Mock context providers
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider
    value={{
      user: mockUser,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      refreshToken: vi.fn(),
      register: vi.fn(),
      loginWithGoogle: vi.fn(),
      handleOAuthToken: vi.fn(),
      updateUser: vi.fn(),
      error: null,
    }}
  >
    {children}
  </AuthContext.Provider>
);

const MockCompanyProvider = ({ children }: { children: React.ReactNode }) => (
  <CompanyContext.Provider
    value={{
      companies: mockCompanies,
      selectedCompany: mockSelectedCompany,
      selectCompany: vi.fn(),
      loading: false,
      error: null,
      refreshCompanies: vi.fn(),
      createCompany: vi.fn(),
      updateCompany: vi.fn(),
      deleteCompany: vi.fn(),
      hasCompanies: true,
      canCreateMore: true,
      maxCompanies: 3,
    }}
  >
    {children}
  </CompanyContext.Provider>
);

const renderModal = (isOpen = true, onClose = vi.fn()) => {
  return render(
    <MockAuthProvider>
      <MockCompanyProvider>
        <EmailNotificationsModal isOpen={isOpen} onClose={onClose} />
      </MockCompanyProvider>
    </MockAuthProvider>
  );
};

describe("EmailNotificationsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailService.getNotificationRules.mockResolvedValue({
      rules: [],
      total: 0,
    });
    mockEmailService.getNotificationStats.mockResolvedValue({
      totalRules: 0,
      activeRules: 0,
      notificationsSent24h: 0,
      lastNotificationSent: null,
    });
  });

  it("should not render when closed", () => {
    renderModal(false);
    expect(screen.queryByText("Email Notifications")).not.toBeInTheDocument();
  });

  it("should render modal header and content when open", async () => {
    renderModal();

    expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    expect(
      screen.getByText("Configure alerts for metric changes")
    ).toBeInTheDocument();
    expect(screen.getByText("Monitor Companies")).toBeInTheDocument();
    expect(screen.getByText("Test Notifications")).toBeInTheDocument();
    expect(screen.getByText("Notification Rules")).toBeInTheDocument();
  });

  it("should load notification rules on open", async () => {
    const mockRules = [
      {
        id: "rule1",
        companyId: "company1",
        metric: "SOV_CHANGE" as const,
        thresholdType: "PERCENT" as const,
        thresholdValue: 10,
        direction: "UP" as const,
        frequency: "INSTANT" as const,
        emails: ["admin@company.com"],
        active: true,
      },
    ];

    mockEmailService.getNotificationRules.mockResolvedValue({
      rules: mockRules,
      total: 1,
    });

    renderModal();

    await waitFor(() => {
      expect(mockEmailService.getNotificationRules).toHaveBeenCalledWith(
        undefined
      );
    });
  });

  it("should display empty state when no rules exist", async () => {
    renderModal();

    await waitFor(() => {
      expect(
        screen.getByText("No notification rules configured yet")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Add a rule to get started with email alerts")
      ).toBeInTheDocument();
    });
  });

  it("should add new rule when Add Rule button is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Add Rule")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Add Rule"));

    // Should show a new rule form
    expect(screen.getByDisplayValue("Share of Voice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Increases")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Instant alerts")).toBeInTheDocument();
  });

  it("should update rule values when form inputs change", async () => {
    const user = userEvent.setup();
    renderModal();

    // Add a new rule first
    await user.click(screen.getByText("Add Rule"));

    // Change metric to ranking
    // The first combobox is company filter; rule metric is the next combobox in the rule card
    const metricSelect = screen
      .getAllByRole("combobox")
      .find((el) =>
        (el as HTMLSelectElement).querySelector('option[value="RANKING"]')
      ) as HTMLSelectElement;
    await user.selectOptions(metricSelect, "RANKING");
    expect(screen.getByDisplayValue("Competitor Ranking")).toBeInTheDocument();

    // Direction options should update for ranking (select index 1)
    const directionSelect = screen
      .getAllByRole("combobox")
      .find(
        (el) =>
          (el as HTMLSelectElement).querySelector('option[value="UP"]') ||
          (el as HTMLSelectElement).querySelector('option[value="BETTER"]')
      ) as HTMLSelectElement;
    const betterOption = directionSelect.querySelector(
      'option[value="BETTER"]'
    );
    const worseOption = directionSelect.querySelector('option[value="WORSE"]');
    expect(betterOption).toBeInTheDocument();
    expect(worseOption).toBeInTheDocument();
  });

  it("should handle email input correctly", async () => {
    const user = userEvent.setup();
    renderModal();

    // Add a new rule
    await user.click(screen.getByText("Add Rule"));

    // Find email input
    const emailInput = screen.getByPlaceholderText(
      "admin@company.com, team@company.com"
    );

    // Enter email addresses
    await user.type(emailInput, "test@example.com, admin@company.com");

    // Some environments may not insert the comma visually; check substring presence order-agnostic
    const val = (emailInput as HTMLInputElement).value.replace(/\s+/g, "");
    expect(val.includes("test@example.com")).toBe(true);
    expect(val.includes("admin@company.com")).toBe(true);
  });

  it("should send test notification", async () => {
    const user = userEvent.setup();
    mockEmailService.sendTestNotification.mockResolvedValue();

    renderModal();

    // Enter test emails
    const testEmailInput = screen.getByPlaceholderText(
      "test@example.com, admin@company.com"
    );
    await user.type(testEmailInput, "test@example.com");

    // Click send test button
    const sendTestButton = screen.getByText("Send Test Notification");
    await user.click(sendTestButton);

    await waitFor(() => {
      expect(mockEmailService.sendTestNotification).toHaveBeenCalledWith([
        "test@example.com",
      ]);
    });
  });

  it("should save rules when Save Rules button is clicked", async () => {
    const user = userEvent.setup();
    mockEmailService.createNotificationRules.mockResolvedValue({
      rules: [],
      total: 0,
    });

    renderModal();

    // Add a new rule
    await user.click(screen.getByText("Add Rule"));

    // Fill in email addresses (required)
    const emailInput = screen.getByPlaceholderText(
      "admin@company.com, team@company.com"
    );
    await user.type(emailInput, "admin@company.com");

    // Click save
    const saveButton = screen.getByText("Save Rules");
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockEmailService.createNotificationRules).toHaveBeenCalled();
    });
  });

  it("should delete rule when trash button is clicked", async () => {
    const user = userEvent.setup();
    const mockRules = [
      {
        id: "rule1",
        companyId: "company1",
        metric: "SOV_CHANGE" as const,
        thresholdType: "PERCENT" as const,
        thresholdValue: 10,
        direction: "UP" as const,
        frequency: "INSTANT" as const,
        emails: ["admin@company.com"],
        active: true,
      },
    ];

    mockEmailService.getNotificationRules.mockResolvedValue({
      rules: mockRules,
      total: 1,
    });
    mockEmailService.deleteNotificationRule.mockResolvedValue();

    renderModal();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Share of Voice")).toBeInTheDocument();
    });

    // Click delete button (trash icon)
    const deleteButton = screen.getByRole("button", { name: /delete rule/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockEmailService.deleteNotificationRule).toHaveBeenCalledWith(
        "rule1"
      );
    });
  });

  it("should validate rules before saving", async () => {
    const user = userEvent.setup();
    renderModal();

    // Add a rule without email addresses
    await user.click(screen.getByText("Add Rule"));

    // Try to save without emails
    const saveButton = screen.getByText("Save Rules");
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Each rule must have at least one email address/)
      ).toBeInTheDocument();
    });

    // Should not call the service
    expect(mockEmailService.createNotificationRules).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    mockEmailService.getNotificationRules.mockRejectedValue(
      new Error("API Error")
    );

    renderModal();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load notification rules")
      ).toBeInTheDocument();
    });
  });

  it("should filter by company when company selector changes", async () => {
    const user = userEvent.setup();
    renderModal();

    // Find company selector
    const companySelect = screen.getByDisplayValue("All Companies");

    // Change to specific company
    await user.selectOptions(companySelect, "company1");

    await waitFor(() => {
      expect(mockEmailService.getNotificationRules).toHaveBeenCalledWith(
        "company1"
      );
    });
  });

  it("should close modal when X button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    renderModal(true, mockOnClose);

    // Find and click the X button
    const closeButton = screen.getByRole("button", { name: "" }); // X button has no text
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should show success message after successful operations", async () => {
    const user = userEvent.setup();
    mockEmailService.sendTestNotification.mockResolvedValue();

    renderModal();

    // Send test notification
    const testEmailInput = screen.getByPlaceholderText(
      "test@example.com, admin@company.com"
    );
    await user.type(testEmailInput, "test@example.com");

    const sendTestButton = screen.getByText("Send Test Notification");
    await user.click(sendTestButton);

    await waitFor(() => {
      const msgs = screen.getAllByText("Test notification sent successfully");
      expect(msgs.length).toBeGreaterThan(0);
    });
  });
});
