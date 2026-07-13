<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Maintenance - ShopTracker</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
        
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            background-color: #09090b; /* Zinc 950 */
            color: #fafafa; /* Zinc 50 */
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            text-align: center;
            padding: 2rem;
            max-width: 500px;
        }

        h1 {
            font-size: 2.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
            letter-spacing: -0.025em;
        }

        p {
            font-size: 1.05rem;
            color: #a1a1aa; /* Zinc 400 */
            line-height: 1.6;
            margin-bottom: 2.5rem;
        }

        /* Sleek horizontal loading bar */
        .loader {
            width: 100%;
            max-width: 200px;
            height: 2px;
            background: #27272a; /* Zinc 800 */
            margin: 0 auto;
            position: relative;
            overflow: hidden;
            border-radius: 2px;
        }

        .loader::after {
            content: '';
            position: absolute;
            left: -50%;
            height: 100%;
            width: 50%;
            background: #fafafa;
            animation: loading 1.5s infinite ease-in-out;
            border-radius: 2px;
        }

        @keyframes loading {
            0% { left: -50%; }
            100% { left: 100%; }
        }

        .logo {
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: -0.05em;
            position: absolute;
            top: 2rem;
            left: 2rem;
            color: #fafafa;
        }
    </style>
</head>
<body>
    <div class="logo">ShopTracker.</div>
    <div class="container">
        <h1>System Update</h1>
        <p>ShopTracker is currently undergoing scheduled maintenance to deploy new features and performance improvements. We'll be back online shortly.</p>
        <div class="loader"></div>
    </div>
</body>
</html>
