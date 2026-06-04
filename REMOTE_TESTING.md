# Remote testing (website — two homes)

Deploy the **Frontend** as a website on Railway. Share one HTTPS link with your teammate.

See **[WEB_DEPLOYMENT.md](WEB_DEPLOYMENT.md)** for deploy steps.

## Quick test checklist

1. Open `https://YOUR-WEB.up.railway.app` (both users)  
2. Login with different usernames  
3. Add each other on **Contacts** (exact username)  
4. Both keep the tab open  
5. **Call** → **Accept** → allow camera/mic  

## Railway services

| Service | URL |
|---------|-----|
| Website | `https://YOUR-WEB.up.railway.app` (after deploy) |
| Backend | `https://wesign-backend-production-7f55.up.railway.app` |
| Signaling | `wss://signaling-server-production-6bfc.up.railway.app` |
| Sign AI | `https://testingfinal-production.up.railway.app` |

## Backend CORS

```text
CLIENT_ORIGIN=https://YOUR-WEB.up.railway.app
```
