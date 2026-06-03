<?php
/**
 * @package     Joomla.Plugin
 * @subpackage  Content.sitehidden
 * @author      @ankont
 * @version     1.0.0
 * @license     GPL-2.0-or-later
 */

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\CMSPlugin;

class PlgContentSitehidden extends CMSPlugin
{
    protected $app;

    private function normalizeShortcodeMarkup(string $html): string
    {
        $emptyParagraph = '<p\b[^>]*>\s*(?:&nbsp;|&#160;|<br\s*\/?>|\s)*<\/p>';

        $html = preg_replace('~<p\b[^>]*>\s*\{site-hidden\}\s*<\/p>~iu', '{site-hidden}', $html);
        $html = preg_replace('~<p\b[^>]*>\s*\{\/site-hidden\}\s*<\/p>~iu', '{/site-hidden}', $html);
        $html = preg_replace('~\{site-hidden\}(?:\s*' . $emptyParagraph . ')+~iu', '{site-hidden}', $html);
        $html = preg_replace('~(?:' . $emptyParagraph . '\s*)+\{\/site-hidden\}~iu', '{/site-hidden}', $html);

        return $html;
    }

    public function onContentPrepare($context, &$article, &$params, $page = 0)
    {
        if (empty($article) || !isset($article->text)) {
            return;
        }

        // Don't remove anything in the administrator application
        if ($this->app->isClient('administrator')) {
            return;
        }

        $user       = Factory::getApplication()->getIdentity();
        $visibility = (string) $this->params->get('visibility', 'none'); // none | superusers | groups
        $groupsCsv  = (string) $this->params->get('groups', '');

        $shouldShow = false;

        if ($visibility === 'superusers') {
            // More robust than checking for group id 8
            $shouldShow = $user->authorise('core.admin');
        } elseif ($visibility === 'groups') {
            $wanted = array_filter(array_map('intval', explode(',', $groupsCsv)));
            if ($wanted) {
                $userGroups = array_keys((array) $user->getGroups());
                $shouldShow = (bool) count(array_intersect($userGroups, $wanted));
            }
        }

        $article->text = $this->normalizeShortcodeMarkup((string) $article->text);

        // Match {site-hidden}...{/site-hidden} across lines, non-greedy
        $pattern = '~\{site-hidden\}(.*?)\{\/site-hidden\}~is';

        if ($shouldShow) {
            // Reveal the inner content (strip only the markers)
            $article->text = preg_replace($pattern, '$1', (string) $article->text);
        } else {
            // Remove the whole block
            $article->text = preg_replace($pattern, '', (string) $article->text);
        }
    }
}
