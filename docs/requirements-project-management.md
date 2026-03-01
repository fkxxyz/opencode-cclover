# Project Management Requirements

## Overview

The project management system enables users to configure and manage multiple projects through a web interface and API, eliminating the need to manually edit YAML configuration files. The system automatically tracks candidate projects and provides a convenient interface for adding them to the configuration.

## Functional Requirements

### Candidate Project Auto-Recording

**Purpose**: Automatically track projects that trigger the plugin but are not yet configured.

**Behavior**:
- When the plugin is invoked in an unconfigured project directory:
  - Output warning message: "Please add this project to ~/.config/opencode-cclover/config.yaml"
  - Automatically record the project to the candidate list
  - Track project path, first seen timestamp, last seen timestamp, and occurrence count
  
**Storage**:
- Candidate projects stored in: `~/.config/opencode-cclover/candidate-projects.yaml`
- Format:
  ```yaml
  candidates:
    - path: /path/to/project
      firstSeenAt: "2026-03-02T10:30:00.000Z"
      lastSeenAt: "2026-03-02T15:45:00.000Z"
      seenCount: 5
  ```

**Update Logic**:
- If project path already exists in candidates:
  - Update `lastSeenAt` to current timestamp
  - Increment `seenCount` by 1
- If project path is new:
  - Add new entry with `firstSeenAt` and `lastSeenAt` set to current timestamp
  - Initialize `seenCount` to 1

### Web Management Interface

**Purpose**: Provide a user-friendly web interface for managing projects.

**Access**: Console management interface at `http://localhost:4097` (default port)

**UI Components**:

1. **Current Projects List**
   - Display all configured projects
   - Show project name, path, and Project ID
   - Provide delete button for each project
   - Support enable/disable toggle (future)

2. **Candidate Projects List**
   - Display all projects that triggered warnings
   - Show project path, first seen time, last seen time, and occurrence count
   - Provide "Add" button to quickly add to configuration
   - Automatically remove from candidate list when added to configuration

3. **Manual Project Addition Form**
   - Input fields:
     - Project Name (required)
     - Project Path (required, must be absolute path)
   - "Add Project" button to submit
   - Validation:
     - Path must be absolute
     - Path must not already exist in configuration

### API Endpoints

**Purpose**: Enable programmatic project management.

**Base URL**: `http://localhost:4097/api`

**Endpoints**:

1. **GET /candidate-projects**
   - Returns list of candidate projects
   - Response format:
     ```json
     {
       "success": true,
       "data": {
         "candidates": [
           {
             "path": "/path/to/project",
             "firstSeenAt": "2026-03-02T10:30:00.000Z",
             "lastSeenAt": "2026-03-02T15:45:00.000Z",
             "seenCount": 5
           }
         ]
       }
     }
     ```

2. **POST /projects**
   - Add new project to configuration
   - Request body:
     ```json
     {
       "name": "My Project",
       "path": "/path/to/project"
     }
     ```
   - Behavior:
     - Add project to `config.yaml`
     - Remove from candidate list if present
     - Return success/error response

3. **POST /projects/delete**
   - Remove project from configuration
   - Request body:
     ```json
     {
       "path": "/path/to/project"
     }
     ```
   - Behavior:
     - Remove project from `config.yaml`
     - Does NOT delete project files
     - Return success/error response

4. **POST /projects/update**
   - Update project configuration
   - Request body:
     ```json
     {
       "path": "/path/to/project",
       "updates": {
         "name": "New Name",
         "enabled": true
       }
     }
     ```
   - Behavior:
     - Update specified fields in `config.yaml`
     - Return success/error response

### Configuration File Management

**Project Configuration**:
- Location: `~/.config/opencode-cclover/config.yaml`
- Format:
  ```yaml
  projects:
    - name: my-project
      path: /path/to/project
      enabled: true
  ```
- Validation:
  - Project paths must be absolute
  - Project paths must be unique
  - Project names should be unique (warning if duplicate)

**Candidate Projects Configuration**:
- Location: `~/.config/opencode-cclover/candidate-projects.yaml`
- Format: See "Candidate Project Auto-Recording" section
- Automatic cleanup: Remove entries when added to main configuration

## Non-functional Requirements

### Usability

- Web interface should be intuitive and require no documentation for basic operations
- API should follow RESTful conventions
- Error messages should be clear and actionable

### Reliability

- File operations should be atomic (use file locking)
- Configuration file corruption should be detected and reported
- Invalid paths should be validated before adding to configuration

### Performance

- Candidate project recording should not impact plugin startup time
- Web interface should load within 1 second
- API responses should complete within 100ms

## Constraints

- Configuration files must be in YAML format
- Web interface runs on single port (4097 by default)
- No authentication required (local-only access)
- Project paths must remain stable (no automatic path updates)

## Assumptions

- Users have write permissions to `~/.config/opencode-cclover/`
- Users understand absolute vs relative paths
- Users will manually restart OpenCode after configuration changes (or wait for auto-reload)
- Candidate project list will not grow excessively large (< 100 entries)

## Dependencies

- **File System**: Read/write access to `~/.config/opencode-cclover/`
- **HTTP Server**: Bun's built-in HTTP server on port 4097
- **YAML Parser**: `yaml` package for configuration file parsing
- **File Locking**: `proper-lockfile` for atomic file operations

## Future Extensions

### Auto-Discovery

- Automatically scan common project directories
- Suggest projects based on directory structure
- Smart project name generation from directory name

### Project Templates

- Predefined project configurations
- Quick setup for common project types
- Template-based employee initialization

### Batch Operations

- Add multiple projects at once
- Bulk enable/disable projects
- Import/export project configurations

### Advanced Filtering

- Filter projects by status (enabled/disabled)
- Search projects by name or path
- Sort projects by various criteria
