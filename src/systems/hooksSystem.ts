/*---------------------------------------------------------------------------------------------
 * Hooks System - Stub implementation for lifecycle hooks
 *--------------------------------------------------------------------------------------------*/

export type HookType = 
  | 'pre_tool_use' 
  | 'post_tool_use' 
  | 'on_tool_error'
  | 'pre_agent_invoke'
  | 'post_agent_invoke'
  | 'on_agent_error'
  | 'user_prompt_submit'
  | 'user_prompt_receive'
  | 'file_changed'
  | 'workspace_changed';

export interface IHookContext {
  toolName?: string;
  toolParameters?: any;
  agentType?: string;
  filePath?: string;
  workspacePath?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface IHookResult {
  success: boolean;
  message?: string;
  data?: any;
  stopExecution?: boolean;
  modifyContext?: Partial<IHookContext>;
}

export interface IHookHandler {
  id: string;
  name: string;
  description: string;
  hookType: HookType;
  priority: number;
  enabled: boolean;
  handler: (context: IHookContext) => Promise<IHookResult>;
}

/**
 * Stub implementation of the Hooks System
 * Provides basic hook management functionality without complex implementation
 */
export class HooksSystem {
  private static instance: HooksSystem;
  private hooks: Map<string, IHookHandler> = new Map();

  private constructor() {}

  public static getInstance(): HooksSystem {
    if (!HooksSystem.instance) {
      HooksSystem.instance = new HooksSystem();
    }
    return HooksSystem.instance;
  }

  public registerHook(hook: IHookHandler): void {
    this.hooks.set(hook.id, hook);
  }

  public unregisterHook(hookId: string): boolean {
    return this.hooks.delete(hookId);
  }

  public enableHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = true;
      return true;
    }
    return false;
  }

  public disableHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = false;
      return true;
    }
    return false;
  }

  public listHooks(hookType?: HookType): IHookHandler[] {
    const allHooks = Array.from(this.hooks.values());
    if (hookType) {
      return allHooks.filter(hook => hook.hookType === hookType);
    }
    return allHooks;
  }

  public async executeHooks(hookType: HookType, context: Partial<IHookContext>): Promise<IHookResult[]> {
    const relevantHooks = this.listHooks(hookType)
      .filter(hook => hook.enabled)
      .sort((a, b) => a.priority - b.priority);

    const results: IHookResult[] = [];
    const fullContext: IHookContext = {
      timestamp: Date.now(),
      ...context
    };

    for (const hook of relevantHooks) {
      try {
        const result = await hook.handler(fullContext);
        results.push(result);
        
        // If hook requests stopping execution, stop here
        if (result.stopExecution) {
          break;
        }

        // Apply context modifications
        if (result.modifyContext) {
          Object.assign(fullContext, result.modifyContext);
        }
      } catch (error) {
        results.push({
          success: false,
          message: `Hook ${hook.id} failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    return results;
  }

  public clearHooks(hookType?: HookType): void {
    if (hookType) {
      const toDelete = Array.from(this.hooks.entries())
        .filter(([, hook]) => hook.hookType === hookType)
        .map(([id]) => id);
      
      toDelete.forEach(id => this.hooks.delete(id));
    } else {
      this.hooks.clear();
    }
  }
}