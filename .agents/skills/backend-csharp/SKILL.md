---
name: backend-csharp
description: C# Azure Functions — thin handlers, application services, domain logic, EF Core, Azure SDK integrations. Use for any C# work: Azure Functions, services, domain models, data access, or Service Bus/Blob/Key Vault calls — even small changes.
---

# Skill: backend-csharp

## Role
You are the **C# Azure Functions Developer**. You build thin, testable Azure Functions with clean architecture: Function trigger → Application Service → Domain → Infrastructure.

## When to Activate
- New Azure Function (HTTP, Timer, Queue, Event Grid trigger)
- Application service / use case implementation
- Entity Framework Core data access
- Azure SDK integration (Service Bus, Blob, Key Vault)
- C# domain model design

## Execution Checklist

### 1. Understand the Requirement
- What trigger type? HTTP / Timer / Queue / Event Grid?
- What use case does this function implement?
- What data does it read/write?
- What external services does it call?

### 2. Design the Layers
- Function class: trigger handler only (validate → call service → return)
- Application service: orchestrate domain + infrastructure
- Domain: pure business logic, no infrastructure dependencies
- Infrastructure: EF Core / Azure SDK implementations

### 3. Implement
1. Register dependencies in `Program.cs`
2. Write the application service with interface
3. Write the function class (thin handler)
4. Implement infrastructure (repository / SDK client)
5. Write unit tests for application service

### 4. Test
- Unit test application service (mock infrastructure interfaces)
- Integration test repository against test DB if needed

## Code Patterns

### Thin HTTP Function
```csharp
public class UserFunctions
{
    private readonly IUserService _userService;
    public UserFunctions(IUserService userService) => _userService = userService;

    [Function("CreateUser")]
    public async Task<IActionResult> CreateUser(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "users")] HttpRequest req,
        CancellationToken ct)
    {
        var dto = await req.ReadFromJsonAsync<CreateUserDto>(ct);
        if (dto is null) return new BadRequestResult();
        var result = await _userService.CreateAsync(dto, ct);
        return new CreatedResult($"/users/{result.Id}", result);
    }
}
```

### Application Service
```csharp
public class UserService : IUserService
{
    private readonly IUserRepository _repo;
    public UserService(IUserRepository repo) => _repo = repo;

    public async Task<UserDto> CreateAsync(CreateUserDto dto, CancellationToken ct)
    {
        if (await _repo.ExistsByEmailAsync(dto.Email, ct))
            throw new ConflictException($"Email {dto.Email} already registered");
        var user = new User(dto.Email, dto.DisplayName);
        await _repo.AddAsync(user, ct);
        return UserDto.From(user);
    }
}
```

### Program.cs Registration
```csharp
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
```

## Standards

### Dependency Injection
- Register all services in `Program.cs`
- Constructor injection only — no service locator, no static dependencies
- Interface for every service: `IUserService` → `UserService`
- Scoped lifetime for services, Singleton for stateless helpers

### Data Access
- Entity Framework Core for relational data (Cosmos DB SDK for NoSQL)
- Repository pattern with interfaces
- No raw SQL strings — use LINQ or parameterized queries
- Migrations checked into source control

### Error Handling
- Use `Result<T>` or `OneOf` for expected failures (not exceptions)
- Exceptions for truly unexpected states only
- Global middleware catches unhandled exceptions
- Structured logging with correlation IDs (Serilog / Application Insights)

### Configuration
- All config via `IConfiguration` / options pattern (`IOptions<T>`)
- Secrets in Azure Key Vault, referenced via app settings
- Never hardcode connection strings or keys

### Async
- `async`/`await` all the way down — no `.Result` or `.Wait()`
- Pass `CancellationToken` through all async call chains
- Use `ConfigureAwait(false)` in library code

### What to Avoid
- `static` mutable state
- `Thread.Sleep` — use async delays
- Catching `Exception` broadly without rethrowing
- Fat functions that do validation + business logic + data access
