# Deployment Guide

## Overview

opencode-cclover is an OpenCode plugin that runs within the OpenCode IDE process. This guide covers installation, configuration, and usage.

## Prerequisites

- **Bun**: >= 1.0.0 (for development and building)
- **OpenCode**: Latest version installed
- **Operating System**: Linux, macOS, or Windows with WSL
- **Permissions**: Write access to `~/.config/opencode-cclover/`

## Installation

### Method 1: Local Development (Recommended for Development)

Use symlink to link the plugin source directly:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Create plugin directory
mkdir -p .opencode/plugin

# Create symlink to plugin source
ln -s /absolute/path/to/opencode-cclover/src/index.ts .opencode/plugin/cclover.ts

# Start OpenCode
opencode serve
```

**Advantages**:
- Changes to plugin source are immediately reflected
- Easy debugging and development
- No build step required

**Disadvantages**:
- Requires absolute path to plugin source
- Must be configured per project

### Method 2: Configuration File Reference

Add plugin reference to project's `opencode.json`:

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/src/index.ts"
  ]
}
```

Then start OpenCode:

```bash
opencode serve
```

**Advantages**:
- Configuration tracked in version control
- Easy to share with team
- Explicit plugin dependencies

**Disadvantages**:
- Requires absolute path
- Must update path if plugin location changes

### Method 3: NPM Package (Future)

Once published to npm:

```bash
# Install plugin
npm install opencode-cclover

# Add to opencode.json
{
  "plugin": ["opencode-cclover"]
}
```

**Advantages**:
- Version management via npm
- Easy updates
- No path configuration needed

**Status**: Not yet implemented

## Configuration

### Initial Setup

1. **Create configuration directory**:
   ```bash
   mkdir -p ~/.config/opencode-cclover
   ```

2. **Create configuration file**:
   ```bash
   touch ~/.config/opencode-cclover/config.yaml
   ```

3. **Add projects to configuration**:
   ```yaml
   projects:
     - name: my-app
       path: /absolute/path/to/my-app
       enabled: true
     - name: blog
       path: /absolute/path/to/blog
       enabled: true
   ```

### Configuration File Format

**Location**: `~/.config/opencode-cclover/config.yaml`

**Schema**:
```yaml
projects:
  - name: string          # Project name (for display)
    path: string          # Absolute path to project root
    enabled: boolean      # Whether project is active
```

**Example**:
```yaml
projects:
  - name: opencode-cclover
    path: /home/user/projects/opencode-cclover
    enabled: true
  - name: my-website
    path: /home/user/projects/my-website
    enabled: true
  - name: old-project
    path: /home/user/projects/old-project
    enabled: false
```

**Validation Rules**:
- `path` must be absolute path
- `path` must be unique across all projects
- `name` should be unique (warning if duplicate)
- `enabled` defaults to `true` if omitted

## Usage

### Using Web Management Interface

1. **Access Console**:
   - Open browser to `http://localhost:4097`
   - Click "Manage Projects" in left sidebar

2. **Add Project from Candidates**:
   - View list of candidate projects (auto-detected)
   - Click "Add" button next to desired project
   - Project automatically added to configuration

3. **Add Project Manually**:
   - Enter project name and absolute path
   - Click "Add Project" button
   - Project added to configuration

4. **Delete Project**:
   - Find project in current projects list
   - Click delete button (trash icon)
   - Confirm deletion
   - Project removed from configuration (files not deleted)

### Using API

**Get Candidate Projects**:
```bash
curl http://localhost:4097/api/candidate-projects
```

**Add Project**:
```bash
curl -X POST http://localhost:4097/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project","path":"/path/to/project"}'
```

**Delete Project**:
```bash
curl -X POST http://localhost:4097/api/projects/delete \
  -H "Content-Type: application/json" \
  -d '{"path":"/path/to/project"}'
```

**Update Project**:
```bash
curl -X POST http://localhost:4097/api/projects/update \
  -H "Content-Type: application/json" \
  -d '{"path":"/path/to/project","updates":{"name":"New Name","enabled":true}}'
```

### Using Tools in OpenCode

Once the plugin is loaded, tools are automatically available in OpenCode AI sessions:

**Send Message**:
```typescript
// Send message to calculator employee
await tools.send_message({
  to: "calculator",
  content: "Calculate 1+1"
})
```

**Manage Tasks**:
```typescript
// Add task
await tools.edit_tasks({
  operations: [
    {
      action: "add",
      name: "ImplementFeature",
      description: "Implement new feature",
      dependencies: []
    }
  ]
})
```

**Create EmployeeWorkSession**:
```typescript
// Create EmployeeWorkSession to execute task
await tools.create_employee_work_session({
  task_name: "ComplexTask",
  prompt: "Execute this complex task..."
})
```

## Verification

### Check Plugin Loaded

1. Start OpenCode with plugin configured
2. Check OpenCode logs for plugin initialization message
3. Verify tools are available in AI session

### Check Global Service Running

```bash
# Check if HTTP server is running
curl http://localhost:4097/api/health

# Expected response:
# {"success":true,"data":{"status":"ok"}}
```

### Check Project Configuration

```bash
# View current configuration
cat ~/.config/opencode-cclover/config.yaml

# View candidate projects
cat ~/.config/opencode-cclover/candidate-projects.yaml
```

### Check Workspace Created

```bash
# Navigate to project directory
cd /path/to/your/project

# Check workspace directory exists
ls -la .cclover/workspace/

# Expected structure:
# .cclover/workspace/
# └── employees/
```

## Troubleshooting

### Plugin Not Loading

**Symptoms**:
- Tools not available in OpenCode
- No plugin initialization message in logs

**Solutions**:
1. Verify plugin path is correct (absolute path required)
2. Check OpenCode logs for error messages
3. Ensure plugin file exists and is readable
4. Try restarting OpenCode

### Configuration File Not Found

**Symptoms**:
- Warning message: "Please add this project to ~/.config/opencode-cclover/config.yaml"
- Project automatically added to candidate list

**Solutions**:
1. Create configuration file: `touch ~/.config/opencode-cclover/config.yaml`
2. Add project to configuration (see Configuration section)
3. Use web interface to add from candidate list
4. Restart OpenCode or wait for auto-n
### HTTP Server Not Accessible

**Symptoms**:
- Cannot access `http://localhost:4097`
- API requests fail with connection error

**Solutions**:
1. Check if port 4097 is already in use: `lsof -i :4097`
2. Verify global service started (check OpenCode logs)
3. Check firewall settings
4. Try accessing from different browser

### Candidate Projects Not Recording

**Symptoms**:
- Candidate projects list is empty
- Projects not auto-detected

**Solutions**:
1. Verify write permissions: `ls -la ~/.config/opencode-cclover/`
2. Check OpenCode logs for file write errors
3. Manually create candidate file: `touch ~/.config/opencode-cclover/candidate-projects.yaml`
4. Ensure YAML format is valid

### Project Changes Not Taking Effect

**Symptoms**:
- Added project not appearing in Console
- Configuration changes not reflected

**Solutions**:
1. Restart OpenCode to reload configuration
2. Wait for automatic configuration reload (if implemented)
3. Check configuration file syntax: `cat ~/.config/opencode-cclover/config.yaml`
4. Verify no YAML parsing errors in logs

### Workspace Permission Errors

**Symptoms**:
- Cannot create workspace directory
- File write errors in logs

**Solutions**:
1. Check project directory permissions
2. Ensure user has write access to project root
3. Manually create workspace: `mkdir -p .cclover/workspace/employees`
4. Check disk space availability

## Rollback

### Disable Plugin

**Method 1: Remove from opencode.json**:
```json
{
  "plugin": []
}
```

**Method 2: Remove symlink**:
```bash
rm .opencode/plugin/cclover.ts
```

**Method 3: Disable all projects**:
```yaml
projects:
  - name: my-app
    path: /path/to/my-app
    enabled: false
```

### Remove Configuration

```bash
# Backup configuration
cp -r ~/.config/opencode-cclover ~/.config/opencode-cclover.backup

# Remove configuration
rm -rf ~/.config/opencode-cclover
```

### Remove Workspace Data

```bash
# Navigate to project directory
cd /path/to/your/project

# Backup workspace
cp -r .cclover .cclover.backup

# Remove workspace
rm -rf .cclover
```

**Warning**: This will delete all employee memory, messages, and tasks. Backup first if needed.

## Maintenance

### Update Plugin

**For Development Installation**:
```bash
cd /path/to/opencode-cclover
git pull
bun install
bun run build
```

**For NPM Installation** (future):
```bash
npm update opencode-cclover
```

### Clean Candidate Projects

```bash
# Edit candidate projects file
nano ~/.config/opencode-cclover/candidate-projects.yaml

# Or delete entire file to reset
rm ~/.config/opencode-cclover/candidate-projects.yaml
```

### Backup Configuration

```bash
# Backup configuration
cp ~/.config/opencode-cclover/config.yaml ~/config-backup.yaml

# Backup all configuration
cp -r ~/.config/opencode-cclover ~/opencode-cclover-backup
```

### Monitor Logs

```bash
# OpenCode logs location (varies by installation)
tail -f ~/.opencode/logs/opencode.log

# Or check OpenCode console output
opencode serve --verbose
```

## Security Notes

- **Local Only**: HTTP server binds to localhost only (no external access)
- **No Authentication**: API has no authentication (assumes trusted local environment)
- **File Permissions**: Configuration files use standard user permissions
- **No Sensitive Data**: Configuration files contain only project paths and names

## Performance Notes

- **Memory Usage**: ~50MB per project instance
- **CPU Usage**: Minimal (event-driven, mostly idle)
- **Disk Usage**: ~1MB per employee (messages + memory)
- **Network**: Local HTTP only (port 4097)

## Support

For issues, questions, or contributions:
- **Repository**: [GitHub Repository URL]
- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues URL]
