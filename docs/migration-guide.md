# Migration Guide: Role Format Update

## Overview

This guide helps you migrate existing role files from the old plain Markdown format to the new YAML frontmatter format.

**What Changed**:
- Old format: Plain Markdown files
- New format: Markdown files with YAML frontmatter containing metadata

**Why the Change**:
- Support role metadata (description, required arguments, hiring permissions, groups)
- Enable parameter validation and reminders
- Implement role-based hiring permissions
- Improve role discoverability and documentation

## Migration Steps

### Step 1: Identify Old Format Roles

Old format roles are plain Markdown files without YAML frontmatter:

```markdown
You are a calculator employee who only performs mathematical calculations.

# Your Responsibilities
- Receive calculation requests
- Execute mathematical calculations
...
```

**Location to check**:
- Project roles: `<project>/.cclover/roles/*.md`
- Global roles: `~/.config/opencode-cclover/roles/*.md`
- Preset roles: `src/roles/*.md` (already migrated)

### Step 2: Add YAML Frontmatter

Convert each old format file by adding YAML frontmatter at the beginning:

**Before** (old format):
```markdown
You are a calculator employee who only performs mathematical calculations.

# Your Responsibilities
...
```

**After** (new format):
```markdown
---
name: "Calculator"
description: "Specialized in mathematical calculations"
requiredArgs: {}
canHire: []
groups: []
---

You are a calculator employee who only performs mathematical calculations.

# Your Responsibilities
...
```

### Step 3: Fill in Metadata Fields

#### Required Fields

- `name`: Must match the filename (without `.md` extension)
  - Example: For `calculator.md`, use `name: "Calculator"`

#### Optional Fields

- `description`: Brief description of the role
  ```yaml
  description: "Specialized in mathematical calculations"
  ```

- `requiredArgs`: Parameters required when hiring this role
  ```yaml
  requiredArgs:
    apiKey:
      type: string
      description: "API key for external service"
    maxRetries:
      type: number
      description: "Maximum retry attempts"
  ```
  - If no required args, use `requiredArgs: {}`

- `canHire`: Roles this role can hire
  ```yaml
  canHire:
    - calculator      # Exact name
    - dev-*           # Glob pattern
    - group:engineers # Group reference
  ```
  - If cannot hire anyone, use `canHire: []`

- `groups`: Groups this role belongs to
  ```yaml
  groups:
    - engineers
    - backend-team
  ```
  - If no groups, use `groups: []`

### Step 4: Validate the Migration

After migrating, validate your role files:

1. **Check syntax**: Ensure YAML frontmatter is valid
   - Must start with `---` on first line
   - Must end with `---` before content
   - Proper YAML indentation (2 spaces)

2. **Verify name matches filename**:
   - `calculator.md` → `name: "Calculator"`
   - `project-manager.md` → `name: "project-manager"`

3. **Test loading**: Restart OpenCode server and check logs
   ```bash
   # Should see: [RoleManager] Loaded N roles for project ...
   ```

4. **Query via API**: Verify role metadata is returned
   ```bash
   curl http://localhost:4097/api/projects/<project-id>/roles
   ```

## Migration Examples

### Example 1: Simple Role (No Metadata)

**Before**:
```markdown
You are a tester employee responsible for testing code.

# Your Responsibilities
- Write test cases
- Execute tests
- Report bugs
```

**After**:
```markdown
---
name: "Tester"
description: "Responsible for testing code and reporting bugs"
requiredArgs: {}
canHire: []
groups:
  - qa
---

You are a tester employee responsible for testing code.

# Your Responsibilities
- Write test cases
- Execute tests
- Report bugs
```

### Example 2: Role with Required Arguments

**Before**:
```markdown
You are a deployment engineer responsible for deploying applications.

# Your Responsibilities
- Deploy applications to production
- Monitor deployment status
- Rollback if needed
```

**After**:
```markdown
---
name: "Deployment Engineer"
description: "Responsible for deploying applications to production"
requiredArgs:
  environment:
    type: string
    description: "Target environment (staging/production)"
  deploymentKey:
    type: string
    description: "Deployment authentication key"
canHire: []
groups:
  - devops
  - operations
---

You are a deployment engineer responsible for deploying applications.

# Your Responsibilities
- Deploy applications to production
- Monitor deployment status
- Rollback if needed
```

### Example 3: Role with Hiring Permissions

**Before**:
```markdown
You are a project manager responsible for coordinating development work.

# Your Responsibilities
- Break down project requirements
- Assign tasks to team members
- Monitor progress
```

**After**:
```markdown
---
name: "Project Manager"
description: "Coordinates development work and manages team"
requiredArgs:
  projectName:
    type: string
    description: "Name of the project to manage"
canHire:
  - dev-*           # Can hire any developer role
  - group:qa        # Can hire anyone in QA group
  - designer        # Can hire designers
groups:
  - management
  - leadership
---

You are a project manager responsible for coordinating development work.

# Your Responsibilities
- Break down project requirements
- Assign tasks to team members
- Monitor progress
```

## Common Issues and Solutions

### Issue 1: Role Not Loading

**Symptom**: Role doesn't appear in role list after migration

**Possible Causes**:
1. YAML frontmatter syntax error
2. Name doesn't match filename
3. Missing closing `---` in frontmatter

**Solution**:
- Check server logs for parsing errors
- Validate YAML syntax using online validator
- Ensure `name` field matches filename exactly

### Issue 2: Old Format Still Works

**Symptom**: Old format files still being loaded

**Explanation**: Old format is deprecated but may still work in some versions

**Solution**:
- Migrate to new format immediately
- Old format support will be removed in future versions
- New features (metadata, permissions) only work with new format

### Issue 3: Required Args Not Showing

**Symptom**: Parameter reminders not appearing in system prompt

**Possible Causes**:
1. `requiredArgs` not defined in frontmatter
2. Employee already has args in memory
3. ContextBuilder not including reminder

**Solution**:
- Verify `requiredArgs` is defined in role file
- Check employee memory: `GET /api/projects/:id/employees/:name/memory`
- Provide args when hiring: `hire_employee` tool with `args` parameter

### Issue 4: Hiring Permission Denied

**Symptom**: Cannot hire role even though it should be allowed

**Possible Causes**:
1. `canHire` not defined in hiring role
2. Pattern doesn't match target role name
3. Group reference incorrect

**Solution**:
- Check hiring role's `canHire` field
- Test pattern matching: `show_hireable_roles` tool
- Verify group membership of target role

## Testing Your Migration

After migrating all roles, test the following:

1. **Role Loading**:
   ```bash
   curl http://localhost:4097/api/projects/<project-id>/roles
   ```
   - Verify all roles appear with metadata

2. **Hiring with Args**:
   ```typescript
   // Use hire_employee tool
   {
     "name": "new-employee",
     "role": "Deployment Engineer",
     "args": {
       "environment": "production",
       "deploymentKey": "key-123"
     }
   }
   ```

3. **Permission Checking**:
   ```typescript
   // Use show_hireable_roles tool
   {
     // Returns list of roles current employee can hire
   }
   ```

4. **Parameter Reminders**:
   - Hire employee without required args
   - Check system prompt includes "Missing Required Parameters" section

## Rollback Plan

If you encounter issues after migration:

1. **Keep backups**: Save old format files before migrating
   ```bash
   cp -r .cclover/roles .cclover/roles.backup
   ```

2. **Restore if needed**:
   ```bash
   rm -rf .cclover/roles
   mv .cclover/roles.backup .cclover/roles
   ```

3. **Report issues**: File bug report with:
   - Role file content (both old and new format)
   - Error messages from logs
   - Steps to reproduce

## Need Help?

- Check [Role Design Documentation](./design-roles.md)
- Review [AGENTS.md Role System Section](../AGENTS.md#role-system)
- See example roles in `src/roles/` directory
- File issues on GitHub repository

## Summary

**Migration Checklist**:
- [ ] Identify all old format role files
- [ ] Add YAML frontmatter to each file
- [ ] Fill in required `name` field
- [ ] Add optional metadata fields as needed
- [ ] Validate YAML syntax
- [ ] Test role loading
- [ ] Verify metadata via API
- [ ] Test hiring with new features
- [ ] Update documentation if needed

**Key Points**:
- Old format is deprecated
- New format required for metadata features
- Migration is straightforward (add frontmatter)
- Test thoroughly after migration
- Keep backups during migration
