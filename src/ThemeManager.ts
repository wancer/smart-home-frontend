enum Theme {
    Dark = 'dark',
    Light = 'light',
}

class ThemeManager {
    private theme: Theme;

    constructor() {
        this.theme = this.guessTheme();
    }

    public init() {
        this.switch(this.theme);
    }

    public getTheme(): Theme {
        return this.theme;
    }

    public toggle(): void {
        let newTheme: Theme;
        if (this.theme === Theme.Dark) {
            newTheme = Theme.Light;
        } else {
            newTheme = Theme.Dark;
        }
        this.switch(newTheme);
    }

    private switch(theme: Theme) {
        this.theme = theme;
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-bs-theme', theme);
    }

    private guessTheme(): Theme {
        const storedTheme = localStorage.getItem('theme');

        if (storedTheme) {
            if (storedTheme === Theme.Dark.toString() || storedTheme === Theme.Light.toString()) {
                return <Theme> storedTheme;
            }
        }

        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return Theme["Dark"];
        }

        return Theme["Light"];
    }
}

const themeManager = new ThemeManager();

export {
    themeManager,
    Theme,
};