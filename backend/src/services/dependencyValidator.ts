/**
 * @file dependencyValidator.ts
 * @description Production-grade dependency validation system
 * Prevents cascade failures by validating all critical dependencies at startup
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import logger from "../utils/logger";

export interface DependencyCheck {
  name: string;
  type: "python" | "node" | "system" | "network";
  required: boolean;
  validator: () => Promise<DependencyResult>;
  remediation?: string;
}

export interface DependencyResult {
  success: boolean;
  message: string;
  details?: any;
  remediation?: string;
}

export class DependencyValidator {
  private static instance: DependencyValidator;
  private checks: DependencyCheck[] = [];
  private validationResults: Map<string, DependencyResult> = new Map();

  public static getInstance(): DependencyValidator {
    if (!DependencyValidator.instance) {
      DependencyValidator.instance = new DependencyValidator();
    }
    return DependencyValidator.instance;
  }

  constructor() {
    this.initializeChecks();
  }

  private initializeChecks(): void {
    this.checks = [
      {
        name: "python-availability",
        type: "python",
        required: true,
        validator: this.validatePythonAvailable.bind(this),
        remediation: "Install Python 3.8+ or set PYTHON_PATH environment variable"
      },
      {
        name: "pydantic-ai-installation",
        type: "python",
        required: true,
        validator: this.validatePydanticAI.bind(this),
        remediation: "Run: pip3 install -r requirements.txt"
      },
      {
        name: "python-requirements-sync",
        type: "python",
        required: true,
        validator: this.validateRequirementsSync.bind(this),
        remediation: "Run: pip3 install -r requirements.txt --upgrade"
      },
      {
        name: "database-connectivity",
        type: "network",
        required: true,
        validator: this.validateDatabaseConnection.bind(this),
        remediation: "Check database connection string and network connectivity"
      },
      {
        name: "redis-connectivity",
        type: "network",
        required: true,
        validator: this.validateRedisConnection.bind(this),
        remediation: "Check Redis connection string and network connectivity"
      },
      {
        name: "aws-credentials",
        type: "system",
        required: false,
        validator: this.validateAWSCredentials.bind(this),
        remediation: "Configure AWS credentials via environment variables or IAM role"
      },
      {
        name: "pydantic-agents-directory",
        type: "system",
        required: true,
        validator: this.validatePydanticAgentsDirectory.bind(this),
        remediation: "Ensure pydantic_agents directory and Python files exist"
      }
    ];
  }

  /**
   * Validate all dependencies with detailed reporting
   */
  public async validateAll(failFast: boolean = false): Promise<{
    success: boolean;
    results: Map<string, DependencyResult>;
    criticalFailures: string[];
    warnings: string[];
  }> {
    logger.info("[DependencyValidator] Starting comprehensive dependency validation");
    
    const criticalFailures: string[] = [];
    const warnings: string[] = [];
    let overallSuccess = true;

    for (const check of this.checks) {
      try {
        logger.info(`[DependencyValidator] Validating ${check.name}...`);
        const result = await check.validator();
        
        this.validationResults.set(check.name, result);
        
        if (!result.success) {
          if (check.required) {
            criticalFailures.push(`${check.name}: ${result.message}`);
            overallSuccess = false;
            
            if (failFast) {
              logger.error(`[DependencyValidator] Critical dependency failed: ${check.name}`, {
                error: result.message,
                remediation: result.remediation || check.remediation
              });
              break;
            }
          } else {
            warnings.push(`${check.name}: ${result.message}`);
          }
        } else {
          logger.info(`[DependencyValidator] ✅ ${check.name} validated successfully`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const failureResult: DependencyResult = {
          success: false,
          message: `Validation error: ${errorMessage}`,
          remediation: check.remediation
        };
        
        this.validationResults.set(check.name, failureResult);
        
        if (check.required) {
          criticalFailures.push(`${check.name}: ${errorMessage}`);
          overallSuccess = false;
        } else {
          warnings.push(`${check.name}: ${errorMessage}`);
        }
      }
    }

    // Log comprehensive summary
    if (overallSuccess) {
      logger.info("[DependencyValidator] ✅ All critical dependencies validated successfully", {
        totalChecks: this.checks.length,
        criticalPassed: this.checks.filter(c => c.required).length,
        warnings: warnings.length
      });
    } else {
      logger.error("[DependencyValidator] ❌ Critical dependency validation failed", {
        criticalFailures: criticalFailures.length,
        totalFailures: criticalFailures,
        warnings
      });
    }

    return {
      success: overallSuccess,
      results: this.validationResults,
      criticalFailures,
      warnings
    };
  }

  /**
   * Python availability check
   */
  private async validatePythonAvailable(): Promise<DependencyResult> {
    const pythonPath = process.env.PYTHON_PATH || "python3";
    
    return new Promise((resolve) => {
      const proc = spawn(pythonPath, ["--version"]);
      let output = "";
      
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });
      
      proc.stderr?.on("data", (data) => {
        output += data.toString();
      });
      
      proc.on("close", (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: `Python available: ${output.trim()}`,
            details: { pythonPath, version: output.trim() }
          });
        } else {
          resolve({
            success: false,
            message: `Python not available at path: ${pythonPath}`,
            details: { pythonPath, exitCode: code },
            remediation: "Install Python 3.8+ or set PYTHON_PATH environment variable"
          });
        }
      });
      
      proc.on("error", (error) => {
        resolve({
          success: false,
          message: `Python execution failed: ${error.message}`,
          details: { pythonPath, error: error.message },
          remediation: "Install Python 3.8+ or set PYTHON_PATH environment variable"
        });
      });
    });
  }

  /**
   * PydanticAI installation check
   */
  private async validatePydanticAI(): Promise<DependencyResult> {
    const pythonPath = process.env.PYTHON_PATH || "python3";
    
    return new Promise((resolve) => {
      const proc = spawn(pythonPath, ["-c", "import pydantic_ai; print(pydantic_ai.__version__)"]);
      let output = "";
      let errorOutput = "";
      
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });
      
      proc.stderr?.on("data", (data) => {
        errorOutput += data.toString();
      });
      
      proc.on("close", (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: `PydanticAI installed: v${output.trim()}`,
            details: { version: output.trim() }
          });
        } else {
          resolve({
            success: false,
            message: `PydanticAI not installed or not accessible: ${errorOutput || 'Module not found'}`,
            details: { exitCode: code, error: errorOutput },
            remediation: "Run: pip3 install -r requirements.txt"
          });
        }
      });
      
      proc.on("error", (error) => {
        resolve({
          success: false,
          message: `PydanticAI validation failed: ${error.message}`,
          details: { error: error.message },
          remediation: "Run: pip3 install -r requirements.txt"
        });
      });
    });
  }

  /**
   * Requirements synchronization check
   */
  private async validateRequirementsSync(): Promise<DependencyResult> {
    try {
      const requirementsPath = path.join(process.cwd(), "requirements.txt");
      const requirementsContent = await fs.readFile(requirementsPath, "utf-8");
      const pythonPath = process.env.PYTHON_PATH || "python3";
      
      // Extract expected versions from requirements.txt
      const expectedPackages = new Map<string, string>();
      const lines = requirementsContent.split("\n");
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const match = trimmed.match(/^([^=<>!]+)[=<>!]+(.+)$/);
          if (match) {
            let [, packageName, version] = match;
            // Handle extras like package[extra1,extra2]==version
            if (packageName.includes('[')) {
              packageName = packageName.split('[')[0];
            }
            expectedPackages.set(packageName.toLowerCase(), version);
          }
        }
      }
      
      // Check installed versions
      return new Promise((resolve) => {
        const proc = spawn(pythonPath, ["-m", "pip", "list", "--format=json"]);
        let output = "";
        
        proc.stdout?.on("data", (data) => {
          output += data.toString();
        });
        
        proc.on("close", (code) => {
          if (code === 0) {
            try {
              const installedPackages = JSON.parse(output);
              const mismatches: string[] = [];
              const missing: string[] = [];
              
              for (const [expectedName, expectedVersion] of expectedPackages) {
                // Handle both underscore and hyphen naming conventions
                const installed = installedPackages.find((pkg: any) => {
                  const pkgNameNormalized = pkg.name.toLowerCase().replace(/_/g, '-');
                  const expectedNameNormalized = expectedName.replace(/_/g, '-');
                  return pkgNameNormalized === expectedNameNormalized || 
                         pkg.name.toLowerCase() === expectedName;
                });
                
                if (!installed) {
                  missing.push(`${expectedName}==${expectedVersion}`);
                } else if (!installed.version.includes(expectedVersion.split("==")[0])) {
                  mismatches.push(
                    `${expectedName}: expected ${expectedVersion}, found ${installed.version}`
                  );
                }
              }
              
              if (missing.length === 0 && mismatches.length === 0) {
                resolve({
                  success: true,
                  message: "All Python requirements are synchronized",
                  details: { checkedPackages: expectedPackages.size }
                });
              } else {
                resolve({
                  success: false,
                  message: `Requirements out of sync: ${missing.length} missing, ${mismatches.length} version mismatches`,
                  details: { missing, mismatches },
                  remediation: "Run: pip3 install -r requirements.txt --upgrade"
                });
              }
            } catch (parseError) {
              resolve({
                success: false,
                message: "Failed to parse pip list output",
                details: { error: parseError },
                remediation: "Run: pip3 install -r requirements.txt"
              });
            }
          } else {
            resolve({
              success: false,
              message: "Failed to list installed packages",
              details: { exitCode: code },
              remediation: "Check pip installation and run: pip3 install -r requirements.txt"
            });
          }
        });
      });
    } catch (error) {
      return {
        success: false,
        message: `Requirements validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        remediation: "Ensure requirements.txt exists and run: pip3 install -r requirements.txt"
      };
    }
  }

  /**
   * Database connectivity check
   */
  private async validateDatabaseConnection(): Promise<DependencyResult> {
    try {
      // Import database service dynamically to avoid circular dependencies
      const { databaseService } = await import("../config/database");
      
      const isHealthy = await databaseService.testConnection();
      
      if (isHealthy) {
        return {
          success: true,
          message: "Database connection successful"
        };
      } else {
        return {
          success: false,
          message: "Database connection failed",
          remediation: "Check database connection string and network connectivity"
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Database validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        remediation: "Check database configuration and network connectivity"
      };
    }
  }

  /**
   * Redis connectivity check
   */
  private async validateRedisConnection(): Promise<DependencyResult> {
    try {
      // Import Redis dynamically to avoid circular dependencies
      const { redis } = await import("../config/redis");
      
      await redis.ping();
      
      return {
        success: true,
        message: "Redis connection successful"
      };
    } catch (error) {
      return {
        success: false,
        message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        remediation: "Check Redis connection string and network connectivity"
      };
    }
  }

  /**
   * AWS credentials check
   */
  private async validateAWSCredentials(): Promise<DependencyResult> {
    try {
      const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
      const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
      const hasRegion = !!process.env.AWS_REGION;
      
      if (hasAccessKey && hasSecretKey && hasRegion) {
        return {
          success: true,
          message: "AWS credentials configured via environment variables",
          details: { method: "environment-variables" }
        };
      } else if (process.env.AWS_EXECUTION_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return {
          success: true,
          message: "AWS credentials available via IAM role",
          details: { method: "iam-role" }
        };
      } else {
        return {
          success: false,
          message: "AWS credentials not configured",
          details: { hasAccessKey, hasSecretKey, hasRegion },
          remediation: "Configure AWS credentials via environment variables or IAM role"
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `AWS credentials validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * PydanticAI agents directory check
   */
  private async validatePydanticAgentsDirectory(): Promise<DependencyResult> {
    try {
      const agentsPath = path.join(process.cwd(), "src", "pydantic_agents");
      const agentsDir = await fs.readdir(agentsPath);
      
      const requiredFiles = ["__init__.py", "base_agent.py", "schemas.py"];
      const requiredDirs = ["agents", "config"];
      
      const missingFiles: string[] = [];
      const missingDirs: string[] = [];
      
      for (const file of requiredFiles) {
        try {
          await fs.access(path.join(agentsPath, file));
        } catch {
          missingFiles.push(file);
        }
      }
      
      for (const dir of requiredDirs) {
        try {
          const stat = await fs.stat(path.join(agentsPath, dir));
          if (!stat.isDirectory()) {
            missingDirs.push(dir);
          }
        } catch {
          missingDirs.push(dir);
        }
      }
      
      if (missingFiles.length === 0 && missingDirs.length === 0) {
        return {
          success: true,
          message: "PydanticAI agents directory structure valid",
          details: { filesFound: agentsDir.length }
        };
      } else {
        return {
          success: false,
          message: "PydanticAI agents directory structure incomplete",
          details: { missingFiles, missingDirs },
          remediation: "Ensure all required Python agent files and directories exist"
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `PydanticAI agents validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        remediation: "Ensure pydantic_agents directory exists with required Python files"
      };
    }
  }

  /**
   * Get validation results for monitoring
   */
  public getValidationResults(): Map<string, DependencyResult> {
    return new Map(this.validationResults);
  }

  /**
   * Get dependency health summary
   */
  public getHealthSummary(): {
    healthy: number;
    unhealthy: number;
    total: number;
    criticalUnhealthy: number;
  } {
    let healthy = 0;
    let unhealthy = 0;
    let criticalUnhealthy = 0;
    
    for (const check of this.checks) {
      const result = this.validationResults.get(check.name);
      if (result) {
        if (result.success) {
          healthy++;
        } else {
          unhealthy++;
          if (check.required) {
            criticalUnhealthy++;
          }
        }
      }
    }
    
    return {
      healthy,
      unhealthy,
      total: this.checks.length,
      criticalUnhealthy
    };
  }
}

export default DependencyValidator;