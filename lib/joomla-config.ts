/**
 * Generate Joomla configuration.php content
 */
export function generateJoomlaConfiguration(params: {
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  siteName?: string;
  secret?: string;
  logPath?: string;
  tmpPath?: string;
}): string {
  const {
    dbHost,
    dbName,
    dbUser,
    dbPassword,
    siteName = "Joomla Site",
    secret = generateRandomSecret(),
    logPath = "",
    tmpPath = "",
  } = params;

  return `<?php
class JConfig {
	public $offline = false;
	public $offline_message = 'This site is down for maintenance.<br>Please check back again soon.';
	public $display_offline_message = 1;
	public $offline_image = '';
	public $sitename = '${escapePHP(siteName)}';
	public $editor = 'tinymce';
	public $captcha = '0';
	public $list_limit = 20;
	public $access = 1;
	public $debug = false;
	public $debug_lang = false;
	public $debug_lang_const = true;
	public $dbtype = 'mysqli';
	public $host = '${escapePHP(dbHost)}';
	public $user = '${escapePHP(dbUser)}';
	public $password = '${escapePHP(dbPassword)}';
	public $db = '${escapePHP(dbName)}';
	public $dbprefix = 'joomla_';
	public $dbencryption = 0;
	public $dbsslverifyservercert = false;
	public $dbsslkey = '';
	public $dbsslcert = '';
	public $dbsslca = '';
	public $dbsslcipher = '';
	public $force_ssl = 0;
	public $live_site = '';
	public $secret = '${escapePHP(secret)}';
	public $gzip = false;
	public $error_reporting = 'default';
	public $helpurl = 'https://help.joomla.org/proxy?keyref=Help{major}{minor}:{keyref}&lang={langcode}';
	public $offset = 'UTC';
	public $mailonline = true;
	public $mailer = 'mail';
	public $mailfrom = '';
	public $fromname = '';
	public $sendmail = '/usr/sbin/sendmail';
	public $smtpauth = false;
	public $smtpuser = '';
	public $smtppass = '';
	public $smtphost = 'localhost';
	public $smtpsecure = 'none';
	public $smtpport = 25;
	public $caching = 0;
	public $cache_handler = 'file';
	public $cachetime = 15;
	public $cache_platformprefix = false;
	public $MetaDesc = '';
	public $MetaAuthor = true;
	public $MetaVersion = false;
	public $robots = '';
	public $sef = true;
	public $sef_rewrite = false;
	public $sef_suffix = false;
	public $unicodeslugs = false;
	public $feed_limit = 10;
	public $feed_email = 'none';
	public $log_path = '${escapePHP(logPath)}';
	public $tmp_path = '${escapePHP(tmpPath)}';
	public $lifetime = 15;
	public $session_handler = 'database';
	public $shared_session = false;
	public $session_metadata = true;
}
`;
}

/**
 * Escape string for PHP code
 */
function escapePHP(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$");
}

/**
 * Generate random secret for Joomla
 */
function generateRandomSecret(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
