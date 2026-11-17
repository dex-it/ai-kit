Функция лежит в `Pricing.cs`, проекта вокруг неё нет:

```csharp
public static class Pricing
{
    public static decimal ApplyDiscount(decimal price, int percent)
    {
        if (price < 0) throw new ArgumentOutOfRangeException(nameof(price));
        if (percent < 0 || percent > 100) throw new ArgumentOutOfRangeException(nameof(percent));
        return Math.Round(price * (100 - percent) / 100m, 2, MidpointRounding.AwayFromZero);
    }
}
```

Нужны xUnit-тесты к ней. `dotnet build` и `dotnet test` не запускай: SDK в среде нет.
