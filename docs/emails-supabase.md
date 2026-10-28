# E-mails de l'espace client (Supabase)

À coller dans Supabase : **Authentication → Emails → Templates**. Chaque modèle a un objet (Subject) et un contenu (Message body, en HTML).

## Confirm signup

**Subject :** Activez votre espace client DZOFT

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0B1020">
  <h2 style="color:#0B1020">Bienvenue chez DZOFT</h2>
  <p>Bonjour,</p>
  <p>Merci pour votre demande. Pour activer votre espace client, cliquez sur le bouton ci-dessous :</p>
  <p style="text-align:center;margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#4361EE;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">Activer mon espace</a>
  </p>
  <p>Vous y suivrez votre demande, recevrez votre devis et pourrez m’écrire.</p>
  <p>Ensuite, pour vous connecter : <a href="https://rdzoagbe.github.io/rd-creations/espace/" style="color:#3448D6">rdzoagbe.github.io/rd-creations/espace</a>, avec votre e-mail et votre mot de passe.</p>
  <p>Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail.</p>
  <p>Roland Dzoagbe<br>DZOFT · 07 82 88 46 46</p>
</div>
```

## Reset password

**Subject :** Choisissez un nouveau mot de passe

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0B1020">
  <h2 style="color:#0B1020">Nouveau mot de passe</h2>
  <p>Bonjour,</p>
  <p>Vous avez demandé à changer le mot de passe de votre espace DZOFT. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
  <p style="text-align:center;margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#4361EE;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">Choisir mon mot de passe</a>
  </p>
  <p>Ensuite, vous vous connecterez à votre espace ici : <a href="https://rdzoagbe.github.io/rd-creations/espace/" style="color:#3448D6">rdzoagbe.github.io/rd-creations/espace</a></p>
  <p>Ce lien n’est valable qu’une fois et pour une durée limitée. Si vous n’avez rien demandé, ignorez cet e-mail : votre mot de passe actuel reste valable.</p>
  <p>Roland Dzoagbe<br>DZOFT · 07 82 88 46 46</p>
</div>
```
